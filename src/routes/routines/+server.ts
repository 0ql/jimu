import { db } from "$lib/server/db";
import { routines } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request, locals }) => {
	const jsn = await request.text();
	const values = {
		uuid: locals.user.uuid,
		routinesJsn: jsn,
	};
	await db
		.insert(routines)
		.values(values)
		.onConflictDoUpdate({ target: routines.uuid, set: values });
	return new Response();
};

export const GET: RequestHandler = async ({ locals }) => {
	const row = (
		await db
			.select({ routinesJsn: routines.routinesJsn })
			.from(routines)
			.where(eq(routines.uuid, locals.user.uuid))
	)[0];
	return new Response(row?.routinesJsn ?? "[]");
};
