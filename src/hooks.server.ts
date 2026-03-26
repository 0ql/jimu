import { validateSession } from '$lib/server/session';
import { redirect, type Handle } from '@sveltejs/kit';

const publicRoutes = ['/login', '/signup'];

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	const session = sessionId ? await validateSession(sessionId) : null;

	event.locals.user = { uuid: session ? session.userUuid : "" }

	if (!event.locals.user?.uuid && !publicRoutes.includes(event.url.pathname)) {
		redirect(303, '/login');
	}

	return resolve(event);
}
