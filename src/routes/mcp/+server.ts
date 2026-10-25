import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildServer } from "#lib/server/mcpTools.js";
import { CORS, preflight, unauthorized, verifyAccessToken } from "#lib/server/oauth.js";
import type { RequestHandler } from "./$types";

// One fresh server per request, scoped to the user the token belongs to (stateless serving).
const handler = createMcpHandler(({ authInfo }) => buildServer(String(authInfo?.extra?.userUuid)));

const serve: RequestHandler = async ({ request, url }) => {
	const auth = await verifyAccessToken(request, url.origin);
	// Claude and ChatGPT start their sign-in only on a 401 that points at the resource metadata.
	if (!auth) return unauthorized(url.origin, request.headers.has("authorization"));

	const response = await handler.fetch(request, {
		authInfo: {
			token: auth.token,
			clientId: auth.grant.clientId,
			scopes: auth.grant.scope.split(" "),
			expiresAt: Math.floor((auth.grant.accessExpiresAt?.getTime() ?? 0) / 1000),
			resource: new URL(auth.grant.resource),
			extra: { userUuid: auth.grant.userUuid },
		},
	});
	const headers = new Headers(response.headers);
	for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
	return new Response(response.body, { status: response.status, headers });
};

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
export const OPTIONS: RequestHandler = preflight;
