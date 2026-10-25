import { error, json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { oauthGrants } from "#lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

/** Disconnects an app: its tokens stop working immediately. Body: { id }. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (typeof body?.id !== "string") error(400, "Expected { id }");
	await db
		.delete(oauthGrants)
		.where(and(eq(oauthGrants.id, body.id), eq(oauthGrants.userUuid, locals.user.uuid)));
	return json({ ok: true });
};
