import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import argon2 from "argon2"
import { createSession, deleteSession, SESSION_DURATION_MS } from "$lib/server/session";

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const jsn = await request.json()
	const user = await db.select().from(users).where(eq(users.username, jsn.username))
	if (!user[0]) {
		return new Response("User not found", { status: 404 })
	}
	if (locals.user?.uuid) {
		deleteSession(cookies.get('session') ?? "")
	}
	const valid = await argon2.verify(user[0].passwordHash, jsn.password)
	if (!valid) {
		return new Response('Bad Credentials', { status: 400 })
	}
	const session = await createSession(user[0].uuid);
	cookies.set('session', session.id, {
		path: '/',
		httpOnly: true,   // not accessible via JS
		secure: process.env.NODE_ENV === 'production',     // HTTPS only
		sameSite: 'lax',  // CSRF protection
		maxAge: SESSION_DURATION_MS
	});
	console.log("Creating Session: ", session)
	return new Response()
}
