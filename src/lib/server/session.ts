import { eq } from "drizzle-orm";
import { db } from "./db";
import { loginSessions, users } from "./db/schema";

export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 10; // 10 Days

export const createSession = async (userUuid: string) => {
	const session = {
		id: crypto.randomUUID(),
		userUuid,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
	};

	await db.insert(loginSessions).values(session);
	return session;
};

/** The session plus whether its user is an admin (one joined query). */
export const validateSession = async (sessionId: string) => {
	const session = await db
		.select({
			id: loginSessions.id,
			userUuid: loginSessions.userUuid,
			expiresAt: loginSessions.expiresAt,
			isAdmin: users.isAdmin,
		})
		.from(loginSessions)
		.innerJoin(users, eq(users.uuid, loginSessions.userUuid))
		.where(eq(loginSessions.id, sessionId));
	if (!session[0]) return null;
	if (session[0].expiresAt < new Date()) {
		await db.delete(loginSessions).where(eq(loginSessions.id, sessionId));
		return null;
	}
	return session[0];
};

export const deleteSession = async (sessionId: string) => {
	await db.delete(loginSessions).where(eq(loginSessions.id, sessionId));
};
