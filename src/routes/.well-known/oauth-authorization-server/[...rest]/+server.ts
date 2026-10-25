import { json } from "@sveltejs/kit";
import { CORS, preflight, SCOPE } from "#lib/server/oauth.js";
import type { RequestHandler } from "./$types";

// RFC 8414 authorization server metadata. Advertising CIMD together with "none" as the token
// endpoint auth method is what makes Claude identify itself by its metadata URL instead of
// registering (there is deliberately no registration endpoint).
export const GET: RequestHandler = ({ url }) =>
	json(
		{
			issuer: url.origin,
			authorization_endpoint: `${url.origin}/oauth/authorize`,
			token_endpoint: `${url.origin}/oauth/token`,
			scopes_supported: [SCOPE],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			code_challenge_methods_supported: ["S256"],
			token_endpoint_auth_methods_supported: ["none"],
			client_id_metadata_document_supported: true,
			authorization_response_iss_parameter_supported: true,
		},
		{ headers: CORS },
	);

export const OPTIONS: RequestHandler = preflight;
