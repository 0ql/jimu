import { error, redirect } from "@sveltejs/kit";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { oauthGrants, users } from "#lib/server/db/schema.js";
import {
	CODE_TTL_MS,
	connectorOrigin,
	hash,
	isOwnResource,
	loadClient,
	newSecret,
	redirectAllowed,
	requestedScopes,
	resourceUrl,
} from "#lib/server/oauth.js";
import type { Actions, PageServerLoad } from "./$types";

/** Sends the browser back to the app with an OAuth result (always with state and issuer). */
const back = (
	redirectUri: string,
	origin: string,
	params: Record<string, string>,
	state: string | null,
) => {
	const target = new URL(redirectUri);
	for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
	if (state) target.searchParams.set("state", state);
	// The issuer, as discovery names it: the connector's address, also when this page is
	// reached under another name (APP_URL).
	target.searchParams.set("iss", connectorOrigin(origin));
	// Only ever a redirect URI already matched against the client's registered ones.
	return redirect(303, target.toString(), { external: [target.origin] });
};

/**
 * Checks an authorization request. Problems with the client or its redirect URI are shown
 * here and never redirected (the redirect target can't be trusted yet); anything else wrong is
 * reported back to the app, as OAuth requires.
 */
const check = async (url: URL) => {
	const p = url.searchParams;
	const clientId = p.get("client_id") ?? "";
	const redirectUri = p.get("redirect_uri") ?? "";
	const state = p.get("state");

	const client = await loadClient(clientId);
	if (!client) error(400, "This app couldn't be verified, so it can't connect to jimu.");
	if (!redirectAllowed(client, redirectUri))
		error(400, "This app asked to return to an address it didn't register.");

	if (p.get("response_type") !== "code")
		back(redirectUri, url.origin, { error: "unsupported_response_type" }, state);
	const challenge = p.get("code_challenge") ?? "";
	if (p.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge))
		back(
			redirectUri,
			url.origin,
			{ error: "invalid_request", error_description: "PKCE S256 is required" },
			state,
		);
	const resource = p.get("resource");
	if (resource && !isOwnResource(resource, url.origin))
		back(redirectUri, url.origin, { error: "invalid_target" }, state);

	const scopes = requestedScopes(p.get("scope"));
	return { client, redirectUri, challenge, state, scopes };
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const { client, redirectUri, scopes } = await check(url);
	const [user] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.uuid, locals.user.uuid));
	const target = new URL(redirectUri);
	return {
		client: { name: client.name, host: client.host },
		// The consent screen shows where the browser goes next (MCP authorization spec).
		returnHost: target.host,
		returnIsLocal: target.protocol === "http:",
		asksToWrite: scopes.includes("write"),
		username: user?.username ?? "",
	};
};

export const actions: Actions = {
	// Both actions check the request again from the URL; the form only says whether to allow changes.
	allow: async ({ url, locals, request }) => {
		const { client, redirectUri, challenge, state, scopes } = await check(url);
		// The one thing taken from the form: whether the user allowed changes. It can only narrow
		// what the app asked for, never widen it.
		const allowChanges = (await request.formData()).get("allow_changes") === "on";
		const scope = scopes.filter((s) => s === "read" || allowChanges).join(" ");
		const code = newSecret();
		// Codes that were never exchanged are dropped once they are well past their expiry.
		await db
			.delete(oauthGrants)
			.where(
				and(
					eq(oauthGrants.userUuid, locals.user.uuid),
					isNull(oauthGrants.accessHash),
					lt(oauthGrants.createdAt, new Date(Date.now() - 2 * CODE_TTL_MS)),
				),
			);
		await db.insert(oauthGrants).values({
			userUuid: locals.user.uuid,
			clientId: client.clientId,
			clientName: client.name,
			redirectUri,
			scope,
			resource: resourceUrl(url.origin),
			codeHash: hash(code),
			codeChallenge: challenge,
			codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
		});
		back(redirectUri, url.origin, { code }, state);
	},
	deny: async ({ url }) => {
		const { redirectUri, state } = await check(url);
		back(redirectUri, url.origin, { error: "access_denied" }, state);
	},
};
