/**
 * Three-way merge for sync. When this device and the server both changed since the last sync,
 * `base` is the copy both started from (what this device last synced), `local` is this
 * device's copy and `server` the server's. Nothing here touches storage or the network.
 *
 * The rules, chosen so that no logged training is ever dropped:
 * - Changed on one side only: that side wins.
 * - Changed on both sides: log lines are combined (a line removed or edited on either side
 *   goes, lines added on either side stay); for a name or setup this device's version wins.
 * - Deleted on one side and edited on the other: the edit wins, so the item stays.
 * - Without a base (e.g. the first sync after this was introduced) nothing counts as removed,
 *   so the result simply holds everything from both sides.
 */
import { datedLines, parseLine } from "./sets";

export type MergeExercise = { id?: number; title: string; workoutsString: string; note?: string };
export type MergeRoutine = { id?: number; name: string; exerciseIds: number[] };

/** A field changed on both sides keeps this device's value. */
const pick = <T>(base: T | undefined, local: T, server: T) => (local === base ? server : local);

/** Lines are compared without trailing spaces ("24.10. " while typing equals "24.10."). */
const key = (line: string) => line.trimEnd();

const nonEmpty = (log: string) => log.split("\n").filter((l) => l.trim());

const counts = (lines: string[]) => {
	const map = new Map<string, number>();
	for (const line of lines) map.set(key(line), (map.get(key(line)) ?? 0) + 1);
	return map;
};

/**
 * Each non-empty line with the time of the day it stands for, worked out within its own log
 * (the year is inferred from the line order, so each side is dated from its own copy). A line
 * without a date sticks to the dated line above it.
 */
const withDates = (log: string, now: Date) => {
	const dated = datedLines(log, now);
	let next = 0;
	let time = -Infinity;
	return nonEmpty(log).map((line) => {
		const isDated = parseLine(line).date !== null;
		if (isDated) time = dated[next++].date.getTime();
		return { line, time, isDated };
	});
};

/**
 * Merges one exercise log. `conflict` is true when both sides added different lines for the
 * same day; both lines are kept, so the caller only needs to tell the user to tidy up.
 */
export const mergeLog = (base: string, local: string, server: string, now = new Date()) => {
	if (local === server || server === base) return { log: local, conflict: false };
	if (local === base) return { log: server, conflict: false };

	const b = counts(nonEmpty(base));
	const l = counts(nonEmpty(local));
	const s = counts(nonEmpty(server));

	// How many copies of each line the result keeps: the base copies minus what either side
	// removed, plus what either side added (the same line added on both sides counts once).
	const quota = new Map<string, number>();
	const addedLocally = new Set<string>();
	const addedOnServer = new Set<string>();
	for (const k of new Set([...b.keys(), ...l.keys(), ...s.keys()])) {
		const nb = b.get(k) ?? 0;
		const nl = l.get(k) ?? 0;
		const ns = s.get(k) ?? 0;
		const removed = Math.max(nb - nl, nb - ns, 0);
		const added = Math.max(nl - nb, ns - nb, 0);
		quota.set(k, nb - removed + added);
		if (nl > nb) addedLocally.add(k);
		if (ns > nb) addedOnServer.add(k);
	}

	// This device's lines first, then the server's, each taking what is left of its quota.
	const picked: { line: string; time: number; order: number; side: "local" | "server" }[] = [];
	for (const [side, log] of [
		["local", local],
		["server", server],
	] as const) {
		for (const row of withDates(log, now)) {
			const k = key(row.line);
			const left = quota.get(k) ?? 0;
			if (left <= 0) continue;
			quota.set(k, left - 1);
			picked.push({ ...row, order: picked.length, side });
		}
	}

	// Chronological again; at equal times the original order holds (stable sort).
	picked.sort((x, y) => x.time - y.time || x.order - y.order);

	const daysAddedHere = new Set(
		picked.filter((p) => p.side === "local" && addedLocally.has(key(p.line))).map((p) => p.time),
	);
	const conflict = picked.some(
		(p) =>
			p.side === "server" &&
			addedOnServer.has(key(p.line)) &&
			Number.isFinite(p.time) &&
			daysAddedHere.has(p.time),
	);

	return { log: picked.map((p) => p.line).join("\n"), conflict };
};

/** Merges an ordered list of ids (a routine's exercises): removals on either side apply. */
export const mergeIds = (base: number[] | undefined, local: number[], server: number[]) => {
	const same = (x: number[], y: number[] | undefined) =>
		!!y && x.length === y.length && x.every((v, i) => v === y[i]);
	if (same(local, server) || same(server, base)) return [...local];
	if (same(local, base)) return [...server];
	const inBase = new Set(base ?? []);
	const inLocal = new Set(local);
	const inServer = new Set(server);
	const kept = local.filter((id) => !(inBase.has(id) && !inServer.has(id)));
	const addedOnServer = server.filter((id) => !inBase.has(id) && !inLocal.has(id));
	return [...new Set([...kept, ...addedOnServer])];
};

/**
 * Merges two lists of items by id. `mergeOne` combines an item present on both sides; `equal`
 * tells whether an item is unchanged from the base.
 */
const mergeById = <T extends { id?: number }>(
	base: T[],
	local: T[],
	server: T[],
	equal: (x: T, y: T) => boolean,
	mergeOne: (b: T | undefined, l: T, s: T) => T,
) => {
	const byId = (list: T[]) => new Map(list.map((item) => [item.id!, item]));
	const b = byId(base);
	const l = byId(local);
	const s = byId(server);
	const merged: T[] = [];
	for (const id of new Set([...l.keys(), ...s.keys()])) {
		const bi = b.get(id);
		const li = l.get(id);
		const si = s.get(id);
		if (li && si) merged.push(mergeOne(bi, li, si));
		// Only here: new on this side, or deleted on the other. A deletion only stands if this
		// side didn't change the item since the base.
		else if (li) {
			if (!bi || !equal(li, bi)) merged.push(li);
		} else if (si) {
			if (!bi || !equal(si, bi)) merged.push(si);
		}
	}
	return merged.sort((x, y) => x.id! - y.id!);
};

const sameExercise = (x: MergeExercise, y: MergeExercise) =>
	x.title === y.title && x.workoutsString === y.workoutsString && (x.note ?? "") === (y.note ?? "");

/** Merges exercise lists; `conflicts` names the exercises where both sides logged the same day. */
export const mergeExercises = <T extends MergeExercise>(
	base: T[],
	local: T[],
	server: T[],
	now = new Date(),
) => {
	const conflicts: string[] = [];
	const merged = mergeById(base, local, server, sameExercise, (b, l, s) => {
		const { log, conflict } = mergeLog(
			b?.workoutsString ?? "",
			l.workoutsString,
			s.workoutsString,
			now,
		);
		const title = pick(b?.title, l.title, s.title);
		if (conflict) conflicts.push(title);
		const note = pick(b?.note, l.note, s.note);
		const result: T = { ...l, title, workoutsString: log };
		if (note) result.note = note;
		else delete result.note;
		return result;
	});
	return { merged, conflicts };
};

const sameRoutine = (x: MergeRoutine, y: MergeRoutine) =>
	x.name === y.name &&
	x.exerciseIds.length === y.exerciseIds.length &&
	x.exerciseIds.every((v, i) => v === y.exerciseIds[i]);

export const mergeRoutines = <T extends MergeRoutine>(base: T[], local: T[], server: T[]) =>
	mergeById(base, local, server, sameRoutine, (b, l, s) => ({
		...l,
		name: pick(b?.name, l.name, s.name),
		exerciseIds: mergeIds(b?.exerciseIds, l.exerciseIds, s.exerciseIds),
	}));

/**
 * An id for a new exercise or routine that won't clash with one made on another device
 * meanwhile: milliseconds since 1970 times 1000 plus a random part. Still a plain number, so
 * links, routines and existing ids keep working.
 */
export const newId = (now = Date.now()) => now * 1000 + Math.floor(Math.random() * 1000);
