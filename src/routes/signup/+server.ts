import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { redirect } from "@sveltejs/kit";
import { type RequestHandler } from "./$types";
import argon2 from "argon2"

export const POST: RequestHandler = async ({ request }) => {
	const jsn = await request.json()
	// TODO: input validation
	const pwdHash = await argon2.hash(jsn.password)
	await db.insert(users).values({ username: jsn.username, passwordHash: pwdHash })
	return redirect(303, '/')
}
