import { db } from "#lib/server/db/index.js";
import { users } from "#lib/server/db/schema.js";
import { count } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import argon2 from "@node-rs/argon2";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

const validate = (username: unknown, password: unknown): string | null => {
	if (typeof username !== "string" || typeof password !== "string") return "Invalid request";
	if (!username.trim()) return "Username is required";
	if (username.length < 3) return "Username must be at least 3 characters";
	if (username.length > 30) return "Username must be at most 30 characters";
	if (!USERNAME_REGEX.test(username)) return "Username can only contain letters, numbers, _ and -";
	if (!password) return "Password is required";
	if (password.length < 8) return "Password must be at least 8 characters";
	return null;
};

const err = (message: string, status: number) =>
	new Response(JSON.stringify({ error: message }), { status });

export const POST: RequestHandler = async ({ request }) => {
	const jsn = await request.json();

	const validationError = validate(jsn.username, jsn.password);
	if (validationError) return err(validationError, 400);

	try {
		const pwdHash = await argon2.hash(jsn.password);
		// The very first account becomes admin. Checking and inserting in one transaction
		// means two simultaneous first sign-ups can't both get it (SQLite has one writer).
		db.transaction((tx) => {
			const isFirst = tx.select({ n: count() }).from(users).get()!.n === 0;
			tx.insert(users)
				.values({ username: jsn.username, passwordHash: pwdHash, isAdmin: isFirst })
				.run();
		});
		return new Response();
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed"))
			return err("Username already taken", 409);
		return err("Something went wrong", 500);
	}
};
