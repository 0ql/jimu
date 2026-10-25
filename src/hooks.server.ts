import { validateSession } from "#lib/server/session.js";
import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";

const publicRoutes = ["/login", "/signup"];

// Authenticated by an OAuth bearer token or not at all (discovery), never by the session cookie.
const isTokenRoute = (path: string) =>
	path === "/mcp" || path === "/oauth/token" || path.startsWith("/.well-known/");

const FORM_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

/**
 * SvelteKit's own cross-site form check is switched off (`csrf.trustedOrigins: ["*"]` in
 * vite.config.ts) because it can't exempt one route. This is the same check, for every route
 * except /oauth/token: Claude's servers POST form-encoded token requests there without an
 * Origin header. That endpoint uses no cookies, so there is nothing to forge.
 */
const isCrossSiteForm = (request: Request, url: URL) => {
	if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
	const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
	if (type && !FORM_TYPES.includes(type)) return false;
	return request.headers.get("origin") !== url.origin;
};

export const handle: Handle = async ({ event, resolve }) => {
	const { url, request } = event;

	if (url.pathname !== "/oauth/token" && isCrossSiteForm(request, url)) {
		return new Response(`Cross-site ${request.method} form submissions are forbidden`, {
			status: 403,
		});
	}

	if (isTokenRoute(url.pathname)) {
		event.locals.user = { uuid: "", isAdmin: false };
		return resolve(event);
	}

	const sessionId = event.cookies.get("session");
	const session = sessionId ? await validateSession(sessionId) : null;

	event.locals.user = { uuid: session?.userUuid ?? "", isAdmin: session?.isAdmin ?? false };

	if (!event.locals.user?.uuid && !publicRoutes.includes(url.pathname)) {
		// Connecting an app starts signed out more often than not: come back here after login.
		if (url.pathname === "/oauth/authorize") {
			redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
		}
		redirect(303, "/login");
	}

	return resolve(event);
};
