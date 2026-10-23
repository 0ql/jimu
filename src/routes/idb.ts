import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { writable, type Writable } from "svelte/store";
import { page } from "$app/state";

export type Exercise = {
	id?: number;
	title: string;
	workoutsString: string;
	/** Machine setup, e.g. "Sitz 3, Rolle 2". */
	note?: string;
};

export type Routine = {
	id?: number;
	name: string;
	exerciseIds: number[];
};

/**
 * Sync bookkeeping per store (id 1 = exercises, id 2 = routines).
 * `lastChanged` is the server's lastModified of the version this device last synced with,
 * so it is only ever compared with other server timestamps. `dirty` means there are local
 * edits the server has not received yet. Records written before the flag existed have no
 * `dirty` and hold a client-clock time instead.
 */
export type SyncMeta = {
	id?: number;
	lastChanged: number;
	dirty?: boolean;
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
}

export const EXERCISES_META = 1;
export const ROUTINES_META = 2;
export const OWNER_META = 3;

export let idb: IDBPDatabase<DB>;
export const synced = writable(true);

export const getSyncMeta = (id: number) => idb.get("meta", id);

export const markSynced = (id: number, lastChanged: number) =>
	idb.put("meta", { id, lastChanged, dirty: false });

const markDirty = async (id: number) => {
	const meta = await idb.get("meta", id);
	await idb.put("meta", { lastChanged: 0, ...meta, id, dirty: true });
};

export type SyncPlan = "push" | "pull" | "conflict" | "none";

/** What to do on startup, given this device's bookkeeping and the server's lastModified. */
export const planSync = (meta: SyncMeta | undefined, serverTs: number): SyncPlan => {
	if (!meta) return serverTs ? "pull" : "none";
	// Pre-flag record: decide one last time by comparing clocks; the sync then rewrites it.
	if (meta.dirty === undefined) {
		if (serverTs > meta.lastChanged) return "pull";
		if (meta.lastChanged > serverTs) return "push";
		return "none";
	}
	if (meta.dirty) return serverTs > meta.lastChanged ? "conflict" : "push";
	if (serverTs > meta.lastChanged) return "pull";
	// The server is behind the version we synced with (e.g. restored database): restore it.
	if (serverTs < meta.lastChanged) return "push";
	return "none";
};

// Edits made while an upload is in flight must keep the store dirty.
let exerciseEdits = 0;
let routineEdits = 0;

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const syncToServer = async () => {
	if (syncTimer) {
		clearTimeout(syncTimer);
		syncTimer = null;
	}
	const editsAtStart = exerciseEdits;
	const exercises = await idb.getAll("exercises");
	const res = await fetch("/", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(exercises),
	});
	if (!res.ok) return;
	const { lastModified } = await res.json();
	if (exerciseEdits === editsAtStart) {
		await markSynced(EXERCISES_META, lastModified);
		synced.set(true);
	} else {
		await idb.put("meta", { id: EXERCISES_META, lastChanged: lastModified, dirty: true });
	}
};

const scheduleSync = () => {
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(syncToServer, 3000);
};

let routineSyncTimer: ReturnType<typeof setTimeout> | null = null;

export const syncRoutinesToServer = async () => {
	if (routineSyncTimer) {
		clearTimeout(routineSyncTimer);
		routineSyncTimer = null;
	}
	const editsAtStart = routineEdits;
	const all = await idb.getAll("routines");
	const res = await fetch("/routines", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(all),
	});
	if (!res.ok) return;
	const { lastModified } = await res.json();
	if (routineEdits === editsAtStart) await markSynced(ROUTINES_META, lastModified);
	else await idb.put("meta", { id: ROUTINES_META, lastChanged: lastModified, dirty: true });
};

const scheduleRoutineSync = () => {
	if (routineSyncTimer) clearTimeout(routineSyncTimer);
	routineSyncTimer = setTimeout(syncRoutinesToServer, 3000);
};

export const exercises: Writable<Exercise[]> = writable([]);
export const routines: Writable<Routine[]> = writable([]);

const updateMeta = async () => {
	exerciseEdits++;
	await markDirty(EXERCISES_META);
};

const updateRoutineMeta = async () => {
	routineEdits++;
	await markDirty(ROUTINES_META);
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
		idb = await openDB<DB>("main", 3, {
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
	const r = await db.getAll("routines");
	console.log(r);
	routines.set(r);
};

export const addExercise = async (title: string, workoutsString = "") => {
	synced.set(false);
	const id = await idb.add("exercises", { title, workoutsString });
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
	await idb.add("routines", { name, exerciseIds: Array.from(exerciseIds) });
	await updateRoutineMeta();
	await loadRoutines();
	scheduleRoutineSync();
};

export const saveRoutine = async (routine: Routine) => {
	await idb.put("routines", { ...routine, exerciseIds: Array.from(routine.exerciseIds) });
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
	if (syncTimer) clearTimeout(syncTimer);
	if (routineSyncTimer) clearTimeout(routineSyncTimer);
	await db.clear("exercises");
	await db.clear("routines");
	await db.clear("meta");
	exercises.set([]);
	routines.set([]);
	synced.set(true);
};

/** Wipes this browser's copy of the data (exercises, routines, sync bookkeeping). */
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

/** Logout: upload pending changes, then clear local data so the next account starts clean. */
export const syncAndClearLocalData = async () => {
	const db = await loadDB();
	if ((await db.get("meta", EXERCISES_META))?.dirty) await syncToServer();
	if ((await db.get("meta", ROUTINES_META))?.dirty) await syncRoutinesToServer();
	await resetLocalData();
};
