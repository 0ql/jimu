import { json } from "@sveltejs/kit";
import { connectorOrigin, CORS, preflight, resourceUrl, SCOPES } from "#lib/server/oauth.js";
import type { RequestHandler } from "./$types";

// RFC 9728 protected resource metadata: "/mcp is protected, and jimu itself issues the tokens".
// Served at the bare path and with the resource path appended (/…/mcp), which clients try first.
export const GET: RequestHandler = ({ url }) =>
	json(
		{
			resource: resourceUrl(url.origin),
			authorization_servers: [connectorOrigin(url.origin)],
			scopes_supported: [...SCOPES],
			bearer_methods_supported: ["header"],
			resource_name: "jimu",
		},
		{ headers: CORS },
	);

export const OPTIONS: RequestHandler = preflight;
