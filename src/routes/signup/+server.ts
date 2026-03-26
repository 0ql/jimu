import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import type { RequestHandler } from "@sveltejs/kit";
import argon2 from "argon2"

export const POST: RequestHandler = async ({ request }) => {
	const jsn = await request.json()
	// TODO: input validation
	console.log(jsn)
	const pwdHash = await argon2.hash(jsn.password)
	const res = await db.insert(users).values({ username: jsn.username, passwordHash: pwdHash })
	console.log(res)
	return new Response()
}
