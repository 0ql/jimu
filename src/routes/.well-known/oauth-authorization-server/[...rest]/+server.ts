import { json } from "@sveltejs/kit";
import { appOrigin, connectorOrigin, CORS, preflight, SCOPES } from "#lib/server/oauth.js";
import type { RequestHandler } from "./$types";

// RFC 8414 authorization server metadata. Advertising CIMD together with "none" as the token
// endpoint auth method is what makes Claude identify itself by its metadata URL instead of
// registering (there is deliberately no registration endpoint). The consent page can live on
// another name than the rest (APP_URL / CONNECTOR_URL): it is opened in the user's browser.
export const GET: RequestHandler = ({ url }) =>
	json(
		{
			issuer: connectorOrigin(url.origin),
			authorization_endpoint: `${appOrigin(url.origin)}/oauth/authorize`,
			token_endpoint: `${connectorOrigin(url.origin)}/oauth/token`,
			scopes_supported: [...SCOPES],
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
