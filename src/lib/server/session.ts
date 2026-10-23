import { eq } from "drizzle-orm";
import { db } from "./db";
import { sessions, users } from "./db/schema";

export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 10; // 10 Days

export const createSession = async (userUuid: string) => {
	const session = {
		id: crypto.randomUUID(),
		userUuid,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
	};

	await db.insert(sessions).values(session);
	return session;
};

/** The session plus whether its user is an admin (one joined query). */
export const validateSession = async (sessionId: string) => {
	const session = await db
		.select({
			id: sessions.id,
			userUuid: sessions.userUuid,
			expiresAt: sessions.expiresAt,
			isAdmin: users.isAdmin,
		})
		.from(sessions)
		.innerJoin(users, eq(users.uuid, sessions.userUuid))
		.where(eq(sessions.id, sessionId));
	if (!session[0]) return null;
	if (session[0].expiresAt < new Date()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}
	return session[0];
};

export const deleteSession = async (sessionId: string) => {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
};
