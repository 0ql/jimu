import { statSync } from "node:fs";
import { error } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { exercises, routines, sessions, users } from "$lib/server/db/schema";
import { datedLines, lineStats, parseLine } from "$lib/sets";
import type { PageServerLoad } from "./$types";

const DAY = 86_400_000;
const WEEKS = 12;

type Log = { workoutsString?: unknown };

/** Training days (one per user per date), sets and volume from one user's exercise blob. */
const summarize = (json: string, now: Date) => {
	let logs: Log[] = [];
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed)) logs = parsed;
	} catch {
		// A broken blob counts as empty rather than taking the page down.
	}
	const days = new Set<number>();
	let sets = 0;
	let volume = 0;
	for (const log of logs) {
		if (typeof log?.workoutsString !== "string") continue;
		for (const { date, line } of datedLines(log.workoutsString, now)) {
			const parsed = parseLine(line).sets;
			const valid = parsed.filter((s) => s.kind !== "invalid");
			if (!valid.length) continue;
			days.add(date.getTime());
			sets += valid.length;
			volume += lineStats(parsed).volume;
		}
	}
	return { exercises: logs.length, days, sets, volume };
};

const countRoutines = (json: string) => {
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed.length : 0;
	} catch {
		return 0;
	}
};

export const load: PageServerLoad = async ({ locals }) => {
	// 404 rather than 403, so the page doesn't reveal that it exists.
	if (!locals.user?.isAdmin) error(404, "Not found");

	const now = new Date();
	const nowMs = now.getTime();

	const [userRows, exerciseRows, routineRows, sessionRows] = await Promise.all([
		db
			.select({
				uuid: users.uuid,
				username: users.username,
				isAdmin: users.isAdmin,
				createdAt: users.createdAt,
			})
			.from(users),
		db
			.select({
				uuid: exercises.uuid,
				lastModified: exercises.lastModified,
				json: exercises.workoutsJsn,
			})
			.from(exercises),
		db.select({ uuid: routines.uuid, json: routines.routinesJsn }).from(routines),
		db.select({ uuid: sessions.userUuid, expiresAt: sessions.expiresAt }).from(sessions),
	]);

	const byUser = new Map(exerciseRows.map((r) => [r.uuid, r]));
	const routinesByUser = new Map(routineRows.map((r) => [r.uuid, countRoutines(r.json)]));

	// Training days per week across all users, oldest week first.
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const weekStart = today - ((now.getDay() + 6) % 7) * DAY - (WEEKS - 1) * 7 * DAY;
	const weekly = Array.from({ length: WEEKS }, (_, i) => ({
		start: weekStart + i * 7 * DAY,
		days: 0,
	}));

	const rows = userRows.map((u) => {
		const ex = byUser.get(u.uuid);
		const s = summarize(ex?.json ?? "[]", now);
		for (const day of s.days) {
			const i = Math.floor((day - weekStart) / (7 * DAY));
			if (i >= 0 && i < WEEKS) weekly[i].days++;
		}
		const lastTrained = s.days.size ? Math.max(...s.days) : null;
		return {
			username: u.username,
			isAdmin: u.isAdmin,
			isMe: u.uuid === locals.user.uuid,
			createdAt: u.createdAt?.getTime() ?? null,
			lastSync: ex?.lastModified?.getTime() ?? null,
			lastTrained,
			exercises: s.exercises,
			trainingDays: s.days.size,
			sets: s.sets,
			volume: s.volume,
			routines: routinesByUser.get(u.uuid) ?? 0,
			activeSessions: sessionRows.filter((x) => x.uuid === u.uuid && x.expiresAt.getTime() > nowMs)
				.length,
		};
	});

	const activeWithin = (days: number) =>
		rows.filter((r) => r.lastSync !== null && nowMs - r.lastSync <= days * DAY).length;

	let databaseBytes: number | null = null;
	try {
		if (process.env.DATABASE_URL) databaseBytes = statSync(process.env.DATABASE_URL).size;
	} catch {
		databaseBytes = null;
	}

	return {
		generatedAt: nowMs,
		totals: {
			users: rows.length,
			admins: rows.filter((r) => r.isAdmin).length,
			newUsers30d: rows.filter((r) => r.createdAt !== null && nowMs - r.createdAt <= 30 * DAY)
				.length,
			active7d: activeWithin(7),
			active30d: activeWithin(30),
			trainingDays: rows.reduce((n, r) => n + r.trainingDays, 0),
			sets: rows.reduce((n, r) => n + r.sets, 0),
			volume: rows.reduce((n, r) => n + r.volume, 0),
			exercises: rows.reduce((n, r) => n + r.exercises, 0),
			routines: rows.reduce((n, r) => n + r.routines, 0),
			activeSessions: rows.reduce((n, r) => n + r.activeSessions, 0),
			databaseBytes,
		},
		weekly,
		users: rows.sort((a, b) => (b.lastSync ?? 0) - (a.lastSync ?? 0)),
	};
};
