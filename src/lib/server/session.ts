import { eq } from "drizzle-orm";
import { db } from "./db";
import { sessions } from "./db/schema";

export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 10; // 10 Days

export const createSession = async (userUuid: string) => {
	const session = {
		id: crypto.randomUUID(),
		userUuid,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
	}

	await db.insert(sessions).values(session)
	return session
}

export const validateSession = async (sessionId: string) => {
	const session = await db.select().from(sessions).where(eq(sessions.id, sessionId))
	if (!session) return null
	if (session[0].expiresAt < new Date()) {
		db.delete(sessions).where(eq(sessions.id, sessionId))
		return null
	}
	return session[0]
}

export const deleteSession = async (sessionId: string) => {
	await db.delete(sessions).where(eq(sessions.id, sessionId))
}
