import { deleteSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user.uuid) {
		return new Response(null, { status: 400 })
	}
	console.log("Logging out", locals.user.uuid)
	if (!cookies.get('session')) {
		return new Response("Session doesn't exist.", { status: 400 })
	}
	await deleteSession(cookies.get('session') ?? "")
	cookies.delete('session', { path: '/' });
	return new Response()
}
