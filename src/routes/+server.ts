import { db } from "$lib/server/db";
import { exercises } from "$lib/server/db/schema";
import { createHash } from "crypto";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request, locals }) => {
	const jsn = await request.text()
	const values = {
		uuid: locals.user.uuid,
		hash: createHash('sha256').update(jsn).digest('hex'),
		workoutsJsn: jsn
	}
	await db.insert(exercises).values(values).onConflictDoUpdate({
		target: exercises.uuid,
		set: values
	})
	return new Response()
}

export const GET: RequestHandler = async ({ locals }) => {
	const res = await db.select().from(exercises).where(eq(exercises.uuid, locals.user.uuid))
	return new Response(res[0].workoutsJsn)
}
