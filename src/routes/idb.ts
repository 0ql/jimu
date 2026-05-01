import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { writable, type Writable } from "svelte/store";

export type Exercise = {
	id?: number;
	title: string;
	workoutsString: string;
};

export interface DB extends DBSchema {
	exercises: {
		key: string;
		value: Exercise;
	};
	meta: {
		key: string;
		value: {
			id?: number;
			lastChanged: number;
		}
	}
}

export let idb: IDBPDatabase<DB>;
export const synced = writable(true);
export const exercises: Writable<Exercise[]> = writable([]);

const updateMeta = async () => {
	await idb.put("meta", { id: 1, lastChanged: Date.now() })
}

export const loadDB = async () => {
	if (idb) return idb
	idb = await openDB<DB>("main", 2, {
		async upgrade(db, oldVersion, newVersion, transaction, event) {
			if (!db.objectStoreNames.contains('exercises')) {
				console.log("Creating Exercises store")
				db.createObjectStore("exercises", {
					keyPath: "id",
					autoIncrement: true,
				});
			}
			if (!db.objectStoreNames.contains('meta')) {
				console.log("Creating Meta store")
				db.createObjectStore("meta", {
					keyPath: "id",
				})
			}
		},
	});
	return idb
}

export const loadExercises = async () => {
	const db = await loadDB();
	exercises.set(await db.getAll("exercises"));
};

export const saveExercise = async (exercise: Exercise) => {
	synced.set(false)
	await idb.put("exercises", { ...exercise });
	await updateMeta()
}

export const clearExersises = async () => {
	synced.set(false)
	await idb.clear("exercises")
}

export const deleteExercise = async (exercise: Exercise) => {
	synced.set(false)
	if (!exercise.id) return
	console.log(exercise.id)
	// @ts-ignore
	await idb.delete("exercises", exercise.id)
}

export const getAll = async (storeName: "meta" | "exercises") => {
	return await idb.getAll(storeName)
}
