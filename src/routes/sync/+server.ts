import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { exercises, routines, splits } from "#lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

/**
 * The server's current version of each store, so a device can check for changes from elsewhere
 * (another device, a connected assistant) without downloading the data.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const [ex] = await db
		.select({ v: exercises.lastModified })
		.from(exercises)
		.where(eq(exercises.uuid, locals.user.uuid));
	const [ro] = await db
		.select({ v: routines.lastModified })
		.from(routines)
		.where(eq(routines.uuid, locals.user.uuid));
	const [sp] = await db
		.select({ v: splits.lastModified })
		.from(splits)
		.where(eq(splits.uuid, locals.user.uuid));
	return json(
		{
			exercises: ex?.v?.getTime() ?? 0,
			routines: ro?.v?.getTime() ?? 0,
			splits: sp?.v?.getTime() ?? 0,
		},
		{ headers: { "cache-control": "no-store" } },
	);
};
