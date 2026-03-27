import { deleteSession } from "$lib/server/session";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user.uuid) {
		return new Response(null, { status: 400 })
	}
	await deleteSession(locals.user.uuid)
	cookies.delete('session', { path: '/' });
	return new Response()
}
