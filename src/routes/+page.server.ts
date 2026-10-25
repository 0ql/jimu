import { db } from "#lib/server/db/index.js";
import { exercises, routines, splits } from "#lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const entry = (
		await db
			.select({ lastModified: exercises.lastModified })
			.from(exercises)
			.where(eq(exercises.uuid, locals.user.uuid))
	)[0];
	const routineEntry = (
		await db
			.select({ lastModified: routines.lastModified })
			.from(routines)
			.where(eq(routines.uuid, locals.user.uuid))
	)[0];
	const splitEntry = (
		await db
			.select({ lastModified: splits.lastModified })
			.from(splits)
			.where(eq(splits.uuid, locals.user.uuid))
	)[0];
	return {
		...entry,
		routineLastModified: routineEntry?.lastModified ?? null,
		splitLastModified: splitEntry?.lastModified ?? null,
	};
};
