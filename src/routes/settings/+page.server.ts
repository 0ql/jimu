import { db } from "#lib/server/db/index.js";
import { users } from "#lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	const user = (
		await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.uuid, locals.user.uuid))
	)[0];
	return { username: user?.username ?? "" };
};
