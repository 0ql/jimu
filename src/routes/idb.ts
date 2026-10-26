import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { isNetworkError, online } from "#lib/network.js";
import { get, writable, type Writable } from "svelte/store";
import { page } from "$app/state";
import { mergeExercises, mergeRoutines, mergeSplits, newId } from "#lib/merge.js";
import { isoDate, type Split } from "#lib/splits.js";
import { isTodayLine, parseLog } from "#lib/sets.js";
import { toast } from "#lib/toast.svelte.js";

export type { Split };

export type Exercise = {
	id?: number;
	title: string;
	workoutsString: string;
	/** Machine setup, e.g. "Seat 3, pad 2". */
	note?: string;
	/** Trained one side at a time (one arm or leg): the volume counts both sides. */
	perSide?: boolean;
};

export type Routine = {
	id?: number;
	name: string;
	exerciseIds: number[];
	/**
	 * Days ("YYYY-MM-DD") this routine was trained: logged while its filter was on. Splits use
	 * them to tell what is due next (see #lib/splits).
	 */
	trainedOn?: string[];
};

/**
 * Sync bookkeeping per store (id 1 = exercises, id 2 = routines, id 4 = splits).
 * `lastChanged` is the server's version (its lastModified) this device last synced with; it is
 * sent with every upload so the server can refuse one based on an older version. `dirty` means
 * there are local edits the server has not received yet. `base` is the copy of the data as it
 * was at that version: when the server refuses, the device merges its copy and the server's
 * against it (see #lib/merge). Records written before the flag existed have no `dirty` and
 * hold a client-clock time instead; their first upload simply merges.
 */
export type SyncMeta = {
	id?: number;
	lastChanged: number;
	dirty?: boolean;
	base?: Exercise[] | Routine[] | Split[];
	/** Only on the OWNER_META record: the account this browser's local data belongs to. */
	owner?: string;
};

export interface DB extends DBSchema {
	exercises: {
		key: string;
		value: Exercise;
	};
	meta: {
		key: number;
		value: SyncMeta;
	};
	routines: {
		key: number;
		value: Routine;
	};
	splits: {
		key: number;
		value: Split;
	};
}

export const EXERCISES_META = 1;
export const ROUTINES_META = 2;
export const OWNER_META = 3;
export const SPLITS_META = 4;

export let idb: IDBPDatabase<DB>;
export const synced = writable(true);
/** Goes up whenever data is replaced from the server or merged, so open editors reload it. */
export const dataRevision = writable(0);

export const getSyncMeta = (id: number) => idb.get("meta", id);

const markDirty = async (id: number) => {
	const meta = await idb.get("meta", id);
	await idb.put("meta", { lastChanged: 0, ...meta, id, dirty: true });
};

type Kind = "exercises" | "routines" | "splits";
const KINDS = {
	exercises: {
		meta: EXERCISES_META,
		url: "/",
		merge: (base: Exercise[], local: Exercise[], server: Exercise[]) =>
			mergeExercises(base, local, server),
		reload: () => loadExercises(),
	},
	routines: {
		meta: ROUTINES_META,
		url: "/routines",
		merge: (base: Routine[], local: Routine[], server: Routine[]) => ({
			merged: mergeRoutines(base, local, server),
			conflicts: [] as string[],
		}),
		reload: () => loadRoutines(),
	},
	splits: {
		meta: SPLITS_META,
		url: "/splits",
		merge: (base: Split[], local: Split[], server: Split[]) => ({
			merged: mergeSplits(base, local, server),
			conflicts: [] as string[],
		}),
		reload: () => loadSplits(),
	},
} as const;

// Counts local edits, so an edit made while a sync is in flight is never marked as synced.
const edits: Record<Kind, number> = { exercises: 0, routines: 0, splits: 0 };
const timers: Record<Kind, ReturnType<typeof setTimeout> | null> = {
	exercises: null,
	routines: null,
	splits: null,
};
// One sync per store at a time (the timer, a reconnect and "Sync now" can all ask at once).
const queues: Record<Kind, Promise<unknown>> = {
	exercises: Promise.resolve(),
	routines: Promise.resolve(),
	splits: Promise.resolve(),
};
const serialized = (kind: Kind, job: () => Promise<unknown>) =>
	(queues[kind] = queues[kind].then(job, job));

// Open log editors register here so their unsaved typing is written before a sync reads the
// data; otherwise a save after the sync could put back a pre-merge copy.
const editors = new Set<() => unknown>();
export const registerEditor = (flush: () => unknown) => {
	editors.add(flush);
	return () => editors.delete(flush);
};

/**
 * POSTs to the server; null when it can't be reached. Offline is not an error here: the data
 * stays dirty on this device and checkForUpdates() syncs it once the connection is back.
 */
const send = async (url: string, body: unknown) => {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		online.set(true);
		return res;
	} catch (error) {
		if (!isNetworkError(error)) throw error;
		online.set(false);
		return null;
	}
};

/** GETs the server's copy and its version; null when the server can't be reached. */
const download = async (url: string) => {
	try {
		const res = await fetch(url);
		online.set(true);
		if (!res.ok) return null;
		return {
			data: await res.json(),
			lastModified: Number(res.headers.get("x-last-modified") ?? 0),
		};
	} catch (error) {
		if (!isNetworkError(error)) throw error;
		online.set(false);
		return null;
	}
};

/** Replaces a store's contents in one transaction. */
const replaceAll = async (kind: Kind, items: (Exercise | Routine | Split)[]) => {
	// idb's typings can't follow a union of store names; both stores hold plain objects.
	const tx = idb.transaction(kind as "exercises", "readwrite");
	await tx.store.clear();
	for (const item of items) await tx.store.put(item as Exercise);
	await tx.done;
};

/** Takes the server's copy as is: used when this device has no unsynced edits. */
const pull = async (kind: Kind) => {
	const k = KINDS[kind];
	const editsAtStart = edits[kind];
	const server = await download(k.url);
	// Unreachable, or edited while downloading: keep the local copy, it gets uploaded instead.
	if (!server || edits[kind] !== editsAtStart) return false;
	await replaceAll(kind, server.data);
	await idb.put("meta", {
		id: k.meta,
		lastChanged: server.lastModified,
		dirty: false,
		base: server.data,
	});
	if (kind === "exercises") synced.set(true);
	// Reload first: open editors remount on the new revision and must see the new data.
	await k.reload();
	dataRevision.update((n) => n + 1);
	return true;
};

const MAX_ATTEMPTS = 3;

/**
 * Uploads this device's copy, based on the version it last synced with. If the server has a
 * newer version, the reply carries it: both copies are merged against the last synced one,
 * stored here, and the merge is uploaded (a few attempts, in case another device keeps
 * syncing meanwhile). Whatever happens, unsynced edits stay marked dirty until they are in.
 */
const upload = async (kind: Kind) => {
	const k = KINDS[kind];
	if (timers[kind]) clearTimeout(timers[kind]);
	timers[kind] = null;

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		if (kind === "exercises") await Promise.all([...editors].map((flush) => flush()));
		const editsAtStart = edits[kind];
		const meta = await idb.get("meta", k.meta);
		const local = await idb.getAll(kind as "exercises");
		const res = await send(k.url, { base: meta?.lastChanged ?? 0, [kind]: local });
		if (!res) return; // Offline: stays dirty.

		if (res.ok) {
			const { lastModified } = await res.json();
			const editedMeanwhile = edits[kind] !== editsAtStart;
			await idb.put("meta", {
				id: k.meta,
				lastChanged: lastModified,
				dirty: editedMeanwhile,
				base: local,
			});
			if (kind === "exercises" && !editedMeanwhile) synced.set(true);
			if (editedMeanwhile) schedule(kind);
			return;
		}

		const body = res.status === 409 ? await res.json().catch(() => null) : null;
		if (!Array.isArray(body?.[kind])) return; // Some other error: try again later.
		if (edits[kind] !== editsAtStart) continue; // Edited meanwhile: start over, fresh copy.

		// The usual case merges against the last synced copy. If the server is older than the
		// version this device synced with (its database was restored), lines missing there
		// weren't deleted by anyone: merging against the server's own copy keeps this device's.
		const serverIsBehind = body.lastModified < (meta?.lastChanged ?? 0);
		const base = serverIsBehind ? body[kind] : (meta?.base ?? []);
		// @ts-expect-error each kind merges its own item type
		const { merged, conflicts } = k.merge(base, local, body[kind]);
		await replaceAll(kind, merged);
		await idb.put("meta", {
			id: k.meta,
			lastChanged: body.lastModified,
			dirty: true,
			base: body[kind],
		});
		await k.reload();
		dataRevision.update((n) => n + 1);
		if (conflicts.length) {
			toast.error(
				`Both devices logged the same day in ${conflicts.join(", ")}. Both entries were kept, so check the log.`,
			);
		} else if (attempt === 0) {
			toast.success("Merged with changes from another device");
		}
	}
};

const schedule = (kind: Kind) => {
	if (timers[kind]) clearTimeout(timers[kind]);
	timers[kind] = setTimeout(() => serialized(kind, () => upload(kind)), 3000);
};
const scheduleSync = () => schedule("exercises");
const scheduleRoutineSync = () => schedule("routines");
const scheduleSplitSync = () => schedule("splits");

export const syncToServer = () => serialized("exercises", () => upload("exercises"));
export const syncRoutinesToServer = () => serialized("routines", () => upload("routines"));
const syncSplitsToServer = () => serialized("splits", () => upload("splits"));

/**
 * Brings one store in line with the server, given the server's current version. Unsynced
 * edits (or no record yet) are uploaded, which merges in anything newer; a clean copy is
 * replaced by a newer server copy. If the server is older than what this device synced with
 * (restored database), this device's copy is uploaded to bring it back. Nothing happens when
 * the versions match.
 */
export const syncWithServer = (kind: Kind, serverVersion: number) =>
	serialized(kind, async () => {
		const meta = await idb.get("meta", KINDS[kind].meta);
		const hasLocal = (await idb.count(kind as "exercises")) > 0;
		if (!meta && !hasLocal) return pull(kind);
		if (!meta || meta.dirty !== false) return upload(kind);
		if (serverVersion > meta.lastChanged) return pull(kind);
		if (serverVersion < meta.lastChanged) return upload(kind);
	});

/**
 * Checks the server for changes made elsewhere (another device, a connected assistant) and
 * brings them in. Only the versions are fetched unless something changed. Unsaved typing is
 * written first, so it gets uploaded and merged rather than replaced.
 */
export const checkForUpdates = async () => {
	if (!page.data.userUuid) return;
	await loadDB();
	let versions: { exercises: number; routines: number; splits?: number };
	try {
		const res = await fetch("/sync", { cache: "no-store" });
		online.set(true);
		// Signed out meanwhile (redirected to the login page): nothing to check.
		if (!res.ok || res.redirected) return;
		versions = await res.json();
	} catch (error) {
		if (!isNetworkError(error)) return;
		online.set(false);
		return;
	}
	await Promise.all([...editors].map((flush) => flush()));
	await Promise.all([
		syncWithServer("exercises", versions.exercises),
		syncWithServer("routines", versions.routines),
		syncWithServer("splits", versions.splits ?? 0),
	]);
};

export const exercises: Writable<Exercise[]> = writable([]);
export const routines: Writable<Routine[]> = writable([]);
export const splits: Writable<Split[]> = writable([]);
/** The routine filter on the exercises tab; logging with it on counts the day for that routine. */
export const trainingRoutineId = writable<number | null>(null);

const updateMeta = async () => {
	edits.exercises++;
	await markDirty(EXERCISES_META);
};

const updateRoutineMeta = async () => {
	edits.routines++;
	await markDirty(ROUTINES_META);
};

const updateSplitMeta = async () => {
	edits.splits++;
	await markDirty(SPLITS_META);
};

/** For bulk writes made outside this module (e.g. the settings import). */
export const markExercisesChanged = async () => {
	synced.set(false);
	await updateMeta();
	await loadExercises();
	scheduleSync();
};

// Which account the local data has been checked against in this page session.
let claimedFor = "";
let claiming: Promise<void> = Promise.resolve();

export const loadDB = async () => {
	if (!idb)
		idb = await openDB<DB>("main", 4, {
			async upgrade(db, oldVersion) {
				if (!db.objectStoreNames.contains("exercises")) {
					db.createObjectStore("exercises", { keyPath: "id", autoIncrement: true });
				}
				if (!db.objectStoreNames.contains("meta")) {
					db.createObjectStore("meta", { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains("routines")) {
					db.createObjectStore("routines", { keyPath: "id", autoIncrement: true });
				}
				if (!db.objectStoreNames.contains("splits")) {
					db.createObjectStore("splits", { keyPath: "id" });
				}
			},
		});
	// Every page reads local data through here, so check ownership before anything else does.
	const uuid: string | undefined = page.data.userUuid;
	if (uuid && uuid !== claimedFor) {
		claimedFor = uuid;
		claiming = claimLocalData(uuid);
	}
	await claiming;
	return idb;
};

export const loadExercises = async () => {
	const db = await loadDB();
	exercises.set(await db.getAll("exercises"));
};

export const loadRoutines = async () => {
	const db = await loadDB();
	routines.set(await db.getAll("routines"));
};

export const loadSplits = async () => {
	const db = await loadDB();
	splits.set(await db.getAll("splits"));
};

export const addExercise = async (title: string, workoutsString = "", note = "") => {
	synced.set(false);
	const id = await idb.add("exercises", {
		id: newId(),
		title,
		workoutsString,
		...(note.trim() ? { note: note.trim() } : {}),
	});
	await updateMeta();
	await loadExercises();
	scheduleSync();
	return Number(id);
};

export const saveExercise = async (exercise: Exercise) => {
	synced.set(false);
	await idb.put("exercises", { ...exercise });
	exercises.update((list) => list.map((e) => (e.id === exercise.id ? { ...exercise } : e)));
	await updateMeta();
	scheduleSync();
};

export const clearExersises = async () => {
	synced.set(false);
	await idb.clear("exercises");
	await updateMeta();
	scheduleSync();
};

export const deleteExercise = async (exercise: Exercise) => {
	synced.set(false);
	if (!exercise.id) return;
	// @ts-ignore
	await idb.delete("exercises", exercise.id);
	await updateMeta();
	await removeExerciseFromAllRoutines(exercise.id);
	scheduleSync();
};

export const addRoutine = async (name: string, exerciseIds: number[]) => {
	await idb.add("routines", { id: newId(), name, exerciseIds: Array.from(exerciseIds) });
	await updateRoutineMeta();
	await loadRoutines();
	scheduleRoutineSync();
};

export const saveRoutine = async (routine: Routine) => {
	await idb.put("routines", {
		...routine,
		exerciseIds: Array.from(routine.exerciseIds),
		...(routine.trainedOn ? { trainedOn: Array.from(routine.trainedOn) } : {}),
	});
	await updateRoutineMeta();
	await loadRoutines();
	scheduleRoutineSync();
};

export const deleteRoutine = async (routine: Routine) => {
	if (!routine.id) return;
	await idb.delete("routines", routine.id);
	await updateRoutineMeta();
	await loadRoutines();
	scheduleRoutineSync();
	await removeRoutineFromAllSplits(routine.id);
};

/** Adds or removes a day from a routine's training days. */
const setTrained = async (routineId: number, date: string, on: boolean) => {
	const routine = await idb.get("routines", routineId);
	if (!routine) return;
	const days = new Set(routine.trainedOn ?? []);
	if (days.has(date) === on) return;
	if (on) days.add(date);
	else days.delete(date);
	await saveRoutine({ ...routine, trainedOn: [...days].sort() });
};

export const markTrained = (routineId: number, date = isoDate()) =>
	setTrained(routineId, date, true);
export const unmarkTrained = (routineId: number, date = isoDate()) =>
	setTrained(routineId, date, false);

/**
 * After a log was saved: with a routine filter on that holds this exercise, a set logged today
 * counts today for that routine.
 */
export const recordTraining = async (exerciseId: number | undefined, log: string) => {
	const routineId = get(trainingRoutineId);
	if (routineId === null || exerciseId === undefined) return;
	const routine = get(routines).find((r) => r.id === routineId);
	if (!routine?.exerciseIds.includes(exerciseId)) return;
	const { current } = parseLog(log);
	if (!isTodayLine(current) || !current.sets.some((s) => s.kind !== "invalid")) return;
	if (routine.trainedOn?.includes(isoDate())) return;
	await markTrained(routineId);
};

/** A plain copy for IndexedDB, which can't store Svelte's state proxies. */
const plainSplit = (split: Split): Split => ({
	...split,
	routineIds: Array.from(split.routineIds),
	days: Array.from(split.days),
	gymDays: Array.from(split.gymDays ?? []),
});

export const addSplit = async (split: Split) => {
	const id = newId();
	await idb.add("splits", { ...plainSplit(split), id });
	await updateSplitMeta();
	await loadSplits();
	scheduleSplitSync();
	return id;
};

export const saveSplit = async (split: Split) => {
	await idb.put("splits", plainSplit(split));
	await updateSplitMeta();
	await loadSplits();
	scheduleSplitSync();
};

export const deleteSplit = async (split: Split) => {
	if (!split.id) return;
	await idb.delete("splits", split.id);
	await updateSplitMeta();
	await loadSplits();
	scheduleSplitSync();
};

/** A deleted routine leaves every split: out of the rotation, its weekdays become rest days. */
const removeRoutineFromAllSplits = async (routineId: number) => {
	let changed = false;
	for (const split of await idb.getAll("splits")) {
		if (!split.routineIds.includes(routineId) && !split.days.includes(routineId)) continue;
		await idb.put("splits", {
			...split,
			routineIds: split.routineIds.filter((id) => id !== routineId),
			days: split.days.map((id) => (id === routineId ? null : id)),
		});
		changed = true;
	}
	if (!changed) return;
	await updateSplitMeta();
	await loadSplits();
	scheduleSplitSync();
};

const removeExerciseFromAllRoutines = async (exerciseId: number) => {
	const all = await idb.getAll("routines");
	let changed = false;
	for (const routine of all) {
		if (routine.exerciseIds.includes(exerciseId)) {
			await idb.put("routines", {
				...routine,
				exerciseIds: routine.exerciseIds.filter((id) => id !== exerciseId),
			});
			changed = true;
		}
	}
	await loadRoutines();
	if (changed) {
		await updateRoutineMeta();
		scheduleRoutineSync();
	}
};

export const getAll = async <S extends "meta" | "exercises">(storeName: S) => {
	return await idb.getAll(storeName);
};

/** Clears the local stores. Takes the open database so it never waits on loadDB(). */
const clearStores = async (db: IDBPDatabase<DB>) => {
	for (const kind of ["exercises", "routines", "splits"] as const) {
		if (timers[kind]) clearTimeout(timers[kind]);
		timers[kind] = null;
	}
	await db.clear("exercises");
	await db.clear("routines");
	await db.clear("splits");
	await db.clear("meta");
	exercises.set([]);
	routines.set([]);
	splits.set([]);
	synced.set(true);
};

/** Wipes this browser's copy of the data (exercises, routines, splits, sync bookkeeping). */
export const resetLocalData = async () => {
	await clearStores(await loadDB());
	// Check ownership again on the next load, whoever signs in.
	claimedFor = "";
};

/**
 * Makes sure local data belongs to `uuid`. If another account's data is still here (e.g. that
 * account's session expired and someone else logged in), it is wiped before any sync so it can
 * never be uploaded into this account. The same account keeps its unsynced edits.
 * Runs inside loadDB(), so it must use the open database directly.
 */
const claimLocalData = async (uuid: string) => {
	const owner = (await idb.get("meta", OWNER_META))?.owner;
	if (owner && owner !== uuid) await clearStores(idb);
	if (owner !== uuid) await idb.put("meta", { id: OWNER_META, lastChanged: 0, owner: uuid });
};

/** Uploads whatever changed on this device while it was offline. */
export const syncPending = async () => {
	if (!idb) return;
	if ((await idb.get("meta", EXERCISES_META))?.dirty) await syncToServer();
	if ((await idb.get("meta", ROUTINES_META))?.dirty) await syncRoutinesToServer();
	if ((await idb.get("meta", SPLITS_META))?.dirty) await syncSplitsToServer();
};

/**
 * Logout: upload pending changes, then clear local data so the next account starts clean.
 * Returns false, and clears nothing, when changes couldn't be uploaded (e.g. offline), so
 * logging out never throws away unsynced training.
 */
export const syncAndClearLocalData = async () => {
	const db = await loadDB();
	await syncPending();
	for (const id of [EXERCISES_META, ROUTINES_META, SPLITS_META]) {
		if ((await db.get("meta", id))?.dirty) return false;
	}
	await resetLocalData();
	return true;
};
