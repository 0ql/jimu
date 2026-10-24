import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { exercises, routines } from "#lib/server/db/schema.js";

/**
 * Saving a user's exercises or routines. An upload says which server version it was based on
 * (`base`, the lastModified the device last synced with). It is stored only if that is still
 * the current version; otherwise nothing is written and the reply (409) carries the current
 * data, which the device merges with its own and uploads again. Checking and writing happen in
 * one transaction, so two devices uploading at once can't both pass.
 */
const STORES = {
	exercises: { table: exercises, data: exercises.workoutsJsn, column: "workoutsJsn" },
	routines: { table: routines, data: routines.routinesJsn, column: "routinesJsn" },
} as const;

type Store = keyof typeof STORES;

export const saveStore = async (store: Store, uuid: string, request: Request) => {
	const body = await request.json().catch(() => null);
	// Older app versions send the bare list and would overwrite blindly: refuse, so their
	// changes stay on the device until that app updates itself.
	if (Array.isArray(body)) {
		return json({ error: "This app version is outdated; reload to sync." }, { status: 409 });
	}
	if (typeof body?.base !== "number" || !Array.isArray(body?.[store])) {
		error(400, `Expected { base, ${store} }`);
	}

	const { table, data, column } = STORES[store];
	const result = db.transaction((tx) => {
		const row = tx
			.select({ lastModified: table.lastModified, data })
			.from(table)
			.where(eq(table.uuid, uuid))
			.get();
		const current = row?.lastModified?.getTime() ?? 0;
		if (body.base !== current) return { stored: false, current, data: row?.data ?? "[]" };

		// Strictly newer than the version it replaces, even within the same millisecond.
		const next = new Date(Math.max(Date.now(), current + 1));
		const values = { [column]: JSON.stringify(body[store]), lastModified: next };
		tx.insert(table)
			.values({ uuid, ...values } as typeof table.$inferInsert)
			.onConflictDoUpdate({ target: table.uuid, set: values })
			.run();
		return { stored: true, current: next.getTime(), data: null };
	});

	if (!result.stored) {
		return json(
			{ lastModified: result.current, [store]: JSON.parse(result.data!) },
			{ status: 409 },
		);
	}
	return json({ lastModified: result.current });
};

/** The stored list, with its version in a header so a download and its version always match. */
export const loadStore = async (store: Store, uuid: string) => {
	const { table, data } = STORES[store];
	const row = (
		await db
			.select({ lastModified: table.lastModified, data })
			.from(table)
			.where(eq(table.uuid, uuid))
	)[0];
	return new Response(row?.data ?? "[]", {
		headers: {
			"content-type": "application/json",
			"x-last-modified": String(row?.lastModified?.getTime() ?? 0),
		},
	});
};
