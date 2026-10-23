import { error, json } from "@sveltejs/kit";
import { count, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";

/** Grant or remove admin rights. Body: { username: string, isAdmin: boolean }. */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	// Same answer as the page for non-admins, so the endpoint doesn't reveal itself either.
	if (!locals.user?.isAdmin) error(404, "Not found");

	const body = await request.json().catch(() => null);
	if (typeof body?.username !== "string" || typeof body?.isAdmin !== "boolean") {
		error(400, "Expected a username and isAdmin");
	}

	const result = db.transaction((tx) => {
		const target = tx
			.select({ uuid: users.uuid, isAdmin: users.isAdmin })
			.from(users)
			.where(eq(users.username, body.username))
			.get();
		if (!target) return { status: 404, message: "User not found" };

		if (!body.isAdmin && target.isAdmin) {
			if (target.uuid === locals.user.uuid) {
				return { status: 400, message: "You can't remove your own admin rights" };
			}
			const admins = tx.select({ n: count() }).from(users).where(eq(users.isAdmin, true)).get()!.n;
			if (admins <= 1) return { status: 400, message: "There has to be at least one admin" };
		}

		tx.update(users).set({ isAdmin: body.isAdmin }).where(eq(users.uuid, target.uuid)).run();
		return null;
	});

	if (result) error(result.status, result.message);
	return json({ username: body.username, isAdmin: body.isAdmin });
};
