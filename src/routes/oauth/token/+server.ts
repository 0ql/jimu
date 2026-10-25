import { and, eq, type SQL } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { oauthGrants } from "#lib/server/db/schema.js";
import {
	ACCESS_TTL_MS,
	CORS,
	hash,
	newSecret,
	pkceMatches,
	preflight,
	REFRESH_TTL_MS,
	isOwnResource,
} from "#lib/server/oauth.js";
import type { RequestHandler } from "./$types";

const reply = (body: object, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
			pragma: "no-cache",
			...CORS,
		},
	});

/**
 * jimu advertises only public clients ("none"), but a client that signs its token requests
 * (ChatGPT can use private_key_jwt) may name itself only inside that signed assertion. The
 * assertion isn't verified: it only says which client is asking, PKCE is what binds the code.
 */
const clientFromAssertion = (assertion: string | null) => {
	try {
		const payload = JSON.parse(Buffer.from(assertion?.split(".")[1] ?? "", "base64url").toString());
		return typeof payload.sub === "string" ? payload.sub : "";
	} catch {
		return "";
	}
};

const fail = (error: string, description?: string) =>
	reply({ error, ...(description ? { error_description: description } : {}) }, 400);

/**
 * A fresh access and refresh token for a connection; the previous pair stops working. `only`
 * is the condition the row must still meet (e.g. still holding the refresh token being
 * rotated), so of two simultaneous requests only one gets tokens.
 */
const issueTokens = (grantId: string, scope: string, only: SQL) => {
	const accessToken = newSecret();
	const refreshToken = newSecret();
	const { changes } = db
		.update(oauthGrants)
		.set({
			codeUsed: true,
			accessHash: hash(accessToken),
			accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
			refreshHash: hash(refreshToken),
			refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
		})
		.where(and(eq(oauthGrants.id, grantId), only))
		.run();
	if (changes === 0) return fail("invalid_grant", "This grant was used concurrently");
	return reply({
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: ACCESS_TTL_MS / 1000,
		refresh_token: refreshToken,
		scope,
	});
};

// Token requests are form-encoded (RFC 6749). Clients here are public (no secret): the
// authorization code is bound by PKCE, the refresh token is rotated on every use.
export const POST: RequestHandler = async ({ request, url }) => {
	const form = new URLSearchParams(await request.text());
	const grantType = form.get("grant_type");
	const clientId = form.get("client_id") ?? clientFromAssertion(form.get("client_assertion"));

	if (grantType === "authorization_code") {
		const code = form.get("code") ?? "";
		const verifier = form.get("code_verifier") ?? "";
		const [grant] = await db
			.select()
			.from(oauthGrants)
			.where(eq(oauthGrants.codeHash, hash(code)));
		if (!grant) return fail("invalid_grant", "Unknown authorization code");
		// A code used twice may have been stolen: revoke the connection it created (RFC 6749 §4.1.2).
		if (grant.codeUsed) {
			await db.delete(oauthGrants).where(eq(oauthGrants.id, grant.id));
			return fail("invalid_grant", "Authorization code already used");
		}
		if (!grant.codeExpiresAt || grant.codeExpiresAt < new Date())
			return fail("invalid_grant", "Authorization code expired");
		if (grant.clientId !== clientId)
			return fail("invalid_grant", "Code was issued to another client");
		if (grant.redirectUri !== form.get("redirect_uri"))
			return fail("invalid_grant", "redirect_uri doesn't match the authorization request");
		if (!grant.codeChallenge || !pkceMatches(verifier, grant.codeChallenge))
			return fail("invalid_grant", "PKCE verification failed");
		const resource = form.get("resource");
		if (resource && !isOwnResource(resource, url.origin)) return fail("invalid_target");

		return issueTokens(grant.id, grant.scope, eq(oauthGrants.codeUsed, false));
	}

	if (grantType === "refresh_token") {
		const refreshToken = form.get("refresh_token") ?? "";
		const [grant] = await db
			.select()
			.from(oauthGrants)
			.where(eq(oauthGrants.refreshHash, hash(refreshToken)));
		if (!grant || !grant.refreshExpiresAt || grant.refreshExpiresAt < new Date())
			return fail("invalid_grant", "Refresh token is invalid or expired");
		if (clientId && grant.clientId !== clientId)
			return fail("invalid_grant", "Refresh token was issued to another client");
		return issueTokens(grant.id, grant.scope, eq(oauthGrants.refreshHash, hash(refreshToken)));
	}

	return fail("unsupported_grant_type");
};

export const OPTIONS: RequestHandler = preflight;
