import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { users } from "#lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

/** Sets the account's weight unit. It is only a label: nothing logged is converted. */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.uuid) error(401, "Not signed in");
	const { unit } = await request.json().catch(() => ({}));
	if (unit !== "kg" && unit !== "lb") error(400, 'Expected { unit: "kg" | "lb" }');
	await db.update(users).set({ unit }).where(eq(users.uuid, locals.user.uuid));
	return json({ unit });
};
