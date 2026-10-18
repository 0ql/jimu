import { db } from "$lib/server/db";
import { exercises } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request, locals }) => {
	const jsn = await request.text();
	const values = {
		uuid: locals.user.uuid,
		workoutsJsn: jsn,
	};
	const [row] = await db
		.insert(exercises)
		.values(values)
		.onConflictDoUpdate({ target: exercises.uuid, set: values })
		.returning({ lastModified: exercises.lastModified });
	// The client stores this as the version it is in sync with, so it never compares clocks.
	return Response.json({ lastModified: row.lastModified?.getTime() ?? 0 });
};

export const GET: RequestHandler = async ({ locals }) => {
	const res = await db.select().from(exercises).where(eq(exercises.uuid, locals.user.uuid));
	return new Response(res[0].workoutsJsn);
};
