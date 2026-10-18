import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { writable, type Writable } from "svelte/store";

export type Exercise = {
	id?: number;
	title: string;
	workoutsString: string;
};

export type Routine = {
	id?: number;
	name: string;
	exerciseIds: number[];
};

export interface DB extends DBSchema {
	exercises: {
		key: string;
		value: Exercise;
	};
	meta: {
		key: number;
		value: {
			id?: number;
			lastChanged: number;
		};
	};
	routines: {
		key: number;
		value: Routine;
	};
}

export let idb: IDBPDatabase<DB>;
export const synced = writable(true);

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export const syncToServer = async () => {
	if (syncTimer) {
		clearTimeout(syncTimer);
		syncTimer = null;
	}
	const exercises = await idb.getAll("exercises");
	const res = await fetch("/", { method: "POST", body: JSON.stringify(exercises) });
	if (res.ok) {
		synced.set(true);
		await idb.put("meta", { id: 1, lastChanged: Date.now() });
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
	const all = await idb.getAll("routines");
	await fetch("/routines", { method: "POST", body: JSON.stringify(all) });
};

const scheduleRoutineSync = () => {
	if (routineSyncTimer) clearTimeout(routineSyncTimer);
	routineSyncTimer = setTimeout(syncRoutinesToServer, 3000);
};

export const exercises: Writable<Exercise[]> = writable([]);
export const routines: Writable<Routine[]> = writable([]);

const updateMeta = async () => {
	await idb.put("meta", { id: 1, lastChanged: Date.now() });
};

const updateRoutineMeta = async () => {
	await idb.put("meta", { id: 2, lastChanged: Date.now() });
};

export const loadDB = async () => {
	if (idb) return idb;
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

export const addExercise = async (title: string) => {
	synced.set(false);
	await idb.add("exercises", { title, workoutsString: "" });
	await updateMeta();
	await loadExercises();
	scheduleSync();
};

export const saveExercise = async (exercise: Exercise) => {
	synced.set(false);
	await idb.put("exercises", { ...exercise });
	await updateMeta();
	scheduleSync();
};

export const clearExersises = async () => {
	synced.set(false);
	await idb.clear("exercises");
	scheduleSync();
};

export const deleteExercise = async (exercise: Exercise) => {
	synced.set(false);
	if (!exercise.id) return;
	// @ts-ignore
	await idb.delete("exercises", exercise.id);
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

export const getRoutineMetaTimestamp = async (): Promise<number> => {
	const entry = await idb.get("meta", 2);
	return entry?.lastChanged ?? 0;
};
