import { validateSession } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const session = await validateSession(sessionId);
		event.locals.userUuid = session ? { id: session.userUuid } : null;
	}

	return resolve(event);
}
