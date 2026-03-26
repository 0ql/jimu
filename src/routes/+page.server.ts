import { db } from "$lib/server/db"
import { exercises } from "$lib/server/db/schema"
import { eq } from "drizzle-orm"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ locals }) => {
	const entry = (await db.select({ hash: exercises.hash, lastModified: exercises.lastModified }).from(exercises).where(eq(exercises.uuid, locals.user.uuid)))[0]
	return entry;
}
