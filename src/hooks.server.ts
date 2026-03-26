import { validateSession } from '$lib/server/session';
import { redirect, type Handle } from '@sveltejs/kit';

const publicRoutes = ['/login', '/signup'];

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	const session = sessionId ? await validateSession(sessionId) : null;

	event.locals.userUuid = session ? { id: session.userUuid } : null;

	if (!event.locals.userUuid && !publicRoutes.includes(event.url.pathname)) {
		redirect(303, '/login');
	}

	return resolve(event);
}
