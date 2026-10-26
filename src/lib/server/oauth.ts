import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { oauthGrants } from "#lib/server/db/schema.js";

/**
 * jimu as its own small OAuth 2.1 authorization server, for the Claude and ChatGPT connector.
 * Claude identifies itself with a Client ID Metadata Document (CIMD): its client ID is the
 * HTTPS URL of a JSON document listing its redirect URIs, so there is no client registration.
 * Public clients only (no secrets), PKCE S256 required.
 *
 * Two scopes: "read" for the training data, "write" to create and change exercises, routines
 * and splits (never to delete). Write is only granted when the user ticks it on the consent page.
 */
export const SCOPES = ["read", "write"] as const;
export type Scope = (typeof SCOPES)[number];

/** The scopes a client asked for that jimu knows, read always included; none asked means all. */
export const requestedScopes = (param: string | null): Scope[] => {
	const asked = (param ?? "").split(/\s+/).filter((s): s is Scope => SCOPES.includes(s as Scope));
	if (!asked.length) return [...SCOPES];
	return SCOPES.filter((s) => s === "read" || asked.includes(s));
};

export const canWrite = (scope: string) => scope.split(" ").includes("write");
export const CODE_TTL_MS = 5 * 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// Client documents are only fetched from these hosts: the server never requests a URL a
// stranger typed into a link. Claude's apps and Claude Code publish theirs on claude.ai,
// ChatGPT at https://chatgpt.com/oauth/client.json.
const CLIENT_HOSTS = ["claude.ai", "claude.com", "chatgpt.com"];

/**
 * CONNECTOR_URL or APP_URL as an origin, or null if unset. Anything after the host is a mistake
 * (e.g. "https://https://jimu.example.com" reads as the host "https"), so it stops the server at
 * startup with a message instead of breaking the sign-in later.
 */
const settingOrigin = (name: "CONNECTOR_URL" | "APP_URL") => {
	const value = process.env[name]?.trim();
	if (!value) return null;
	const wrong = () =>
		new Error(
			`${name} must be just a scheme and host, like https://jimu.example.com (got "${value}")`,
		);
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw wrong();
	}
	if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash)
		throw wrong();
	return url.origin;
};

const CONNECTOR_ORIGIN = settingOrigin("CONNECTOR_URL");
const APP_ORIGIN = settingOrigin("APP_URL");

/**
 * Where connectors reach jimu: the MCP endpoint, OAuth discovery and the token exchange, and
 * the issuer name. CONNECTOR_URL when that is a public name of its own (e.g. a tunnel that only
 * lets those paths through while the app itself stays on a VPN); else the address the request
 * came in on. Functions here take the request's origin and map it.
 */
export const connectorOrigin = (requestOrigin: string) => CONNECTOR_ORIGIN ?? requestOrigin;

/**
 * Where the user's browser approves a connection (the consent page, behind the jimu login):
 * APP_URL, else the address the request came in on.
 */
export const appOrigin = (requestOrigin: string) => APP_ORIGIN ?? requestOrigin;

/** The paths a connector uses; on the connector's own name nothing else is answered. */
export const isConnectorPath = (path: string) =>
	path === "/mcp" ||
	path === "/oauth/token" ||
	/^\/\.well-known\/oauth-(protected-resource|authorization-server)(\/.*)?$/.test(path);

/**
 * Whether a request came in on the connector's own name: CONNECTOR_URL, when APP_URL puts the
 * app on another one. Only connector paths are answered there, so a mistake in the tunnel's
 * rules can't expose the app or its login. With just CONNECTOR_URL set the app shares that
 * name, so nothing is restricted.
 */
const CONNECTOR_ONLY_HOST =
	CONNECTOR_ORIGIN && APP_ORIGIN && new URL(CONNECTOR_ORIGIN).host !== new URL(APP_ORIGIN).host
		? new URL(CONNECTOR_ORIGIN).host
		: null;

// By name only, so a missing protocol header can't make the check miss.
export const onConnectorHost = (url: URL) => url.host === CONNECTOR_ONLY_HOST;

/** The MCP endpoint, which is also the resource tokens are issued for. */
export const resourceUrl = (origin: string) => `${connectorOrigin(origin)}/mcp`;
/**
 * Whether a client's `resource` parameter names this MCP server. Clients send either the MCP
 * endpoint itself or just the server's origin (ChatGPT's docs show the latter); tokens are
 * always issued for the endpoint.
 */
export const isOwnResource = (resource: string, origin: string) =>
	[resourceUrl(origin), connectorOrigin(origin)].includes(resource.replace(/\/$/, ""));

export const resourceMetadataUrl = (origin: string) =>
	`${connectorOrigin(origin)}/.well-known/oauth-protected-resource/mcp`;

export const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
export const newSecret = () => randomBytes(32).toString("base64url");

/** PKCE S256: the base64url SHA-256 of the verifier must equal the stored challenge. */
export const pkceMatches = (verifier: string, challenge: string) => {
	if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
	const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
	const expected = Buffer.from(challenge);
	return computed.length === expected.length && timingSafeEqual(computed, expected);
};

export type ClientMetadata = {
	clientId: string;
	name: string;
	host: string;
	redirectUris: string[];
};

const clientCache = new Map<string, { at: number; client: ClientMetadata }>();
const CLIENT_CACHE_MS = 60 * 60 * 1000;

/**
 * Fetches and checks a client's metadata document; null if the client ID isn't an allowed
 * HTTPS URL or the document doesn't hold up (its own client_id must equal the URL).
 */
export const loadClient = async (clientId: string): Promise<ClientMetadata | null> => {
	let url: URL;
	try {
		url = new URL(clientId);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || !CLIENT_HOSTS.includes(url.hostname) || url.hash) return null;

	const cached = clientCache.get(clientId);
	if (cached && Date.now() - cached.at < CLIENT_CACHE_MS) return cached.client;

	try {
		const res = await fetch(url, {
			redirect: "error",
			signal: AbortSignal.timeout(5000),
			headers: { accept: "application/json" },
		});
		if (!res.ok) return null;
		const doc = await res.json();
		if (doc?.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
		const client: ClientMetadata = {
			clientId,
			name: typeof doc.client_name === "string" ? doc.client_name.slice(0, 80) : url.hostname,
			host: url.hostname,
			redirectUris: doc.redirect_uris.filter((u: unknown) => typeof u === "string"),
		};
		clientCache.set(clientId, { at: Date.now(), client });
		return client;
	} catch {
		return null;
	}
};

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Whether a redirect URI is one the client registered: exactly, or for a loopback address on
 * any port (native apps such as Claude Code pick a free port each time, RFC 8252).
 */
export const redirectAllowed = (client: ClientMetadata, redirectUri: string) => {
	if (client.redirectUris.includes(redirectUri)) return true;
	let requested: URL;
	try {
		requested = new URL(redirectUri);
	} catch {
		return false;
	}
	if (requested.protocol !== "http:" || !LOOPBACK.includes(requested.hostname)) return false;
	return client.redirectUris.some((registered) => {
		try {
			const r = new URL(registered);
			return (
				r.protocol === "http:" &&
				r.hostname === requested.hostname &&
				r.pathname === requested.pathname &&
				r.search === requested.search
			);
		} catch {
			return false;
		}
	});
};

/**
 * The connection behind a bearer token on the MCP endpoint, or null if the token is unknown,
 * expired, or was issued for another resource.
 */
export const verifyAccessToken = async (request: Request, origin: string) => {
	const match = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
	if (!match) return null;
	const [grant] = await db
		.select()
		.from(oauthGrants)
		.where(
			and(eq(oauthGrants.accessHash, hash(match[1])), gt(oauthGrants.accessExpiresAt, new Date())),
		);
	if (!grant || grant.resource !== resourceUrl(origin)) return null;

	// Settings shows when Claude last read the data; once a minute is precise enough.
	if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > 60_000) {
		await db
			.update(oauthGrants)
			.set({ lastUsedAt: new Date() })
			.where(eq(oauthGrants.id, grant.id));
	}
	return { token: match[1], grant };
};

/** The 401 that tells Claude where to sign in (RFC 9728 / the MCP authorization spec). */
export const unauthorized = (origin: string, hadToken: boolean) =>
	new Response(JSON.stringify({ error: "invalid_token" }), {
		status: 401,
		headers: {
			"content-type": "application/json",
			"www-authenticate": `Bearer ${hadToken ? 'error="invalid_token", ' : ""}resource_metadata="${resourceMetadataUrl(origin)}", scope="${SCOPES.join(" ")}"`,
			...CORS,
		},
	});

/** Discovery, token and MCP responses may be read from browsers too (e.g. the MCP Inspector). */
export const CORS = {
	"access-control-allow-origin": "*",
	"access-control-allow-headers":
		"authorization, content-type, mcp-protocol-version, mcp-session-id",
	"access-control-expose-headers": "www-authenticate, mcp-session-id",
	"access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });
