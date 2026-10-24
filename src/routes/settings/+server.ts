import { db } from "#lib/server/db/index.js";
import { users } from "#lib/server/db/schema.js";
import { deleteSession } from "#lib/server/session.js";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import argon2 from "@node-rs/argon2";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

const err = (message: string, status: number) =>
	new Response(JSON.stringify({ error: message }), { status });

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user.uuid) {
		return new Response(null, { status: 400 });
	}
	console.log("Logging out", locals.user.uuid);
	if (!cookies.get("session")) {
		return new Response("Session doesn't exist.", { status: 400 });
	}
	await deleteSession(cookies.get("session") ?? "");
	cookies.delete("session", { path: "/" });
	return new Response();
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.uuid) {
		return err("Not authenticated", 401);
	}

	const { username, currentPassword, newPassword } = await request.json();

	const user = (await db.select().from(users).where(eq(users.uuid, locals.user.uuid)))[0];
	if (!user) return err("User not found", 404);

	const valid = await argon2.verify(user.passwordHash, currentPassword);
	if (!valid) return err("Current password is incorrect", 403);

	const updates: Partial<{ username: string; passwordHash: string }> = {};

	if (username && username !== user.username) {
		if (typeof username !== "string") return err("Invalid username", 400);
		if (username.length < 3) return err("Username must be at least 3 characters", 400);
		if (username.length > 30) return err("Username must be at most 30 characters", 400);
		if (!USERNAME_REGEX.test(username))
			return err("Username can only contain letters, numbers, _ and -", 400);
		updates.username = username;
	}

	if (newPassword) {
		if (typeof newPassword !== "string") return err("Invalid password", 400);
		if (newPassword.length < 8) return err("New password must be at least 8 characters", 400);
		updates.passwordHash = await argon2.hash(newPassword);
	}

	if (Object.keys(updates).length === 0) {
		return err("Nothing to update", 400);
	}

	try {
		await db.update(users).set(updates).where(eq(users.uuid, locals.user.uuid));
		return new Response(JSON.stringify({ username: updates.username ?? user.username }));
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed"))
			return err("Username already taken", 409);
		return err("Something went wrong", 500);
	}
};
