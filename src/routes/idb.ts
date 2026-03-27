import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { writable } from "svelte/store";

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

const updateMeta = async () => {
	await idb.put("meta", { id: 1, lastChanged: Date.now() })
}

export const loadDB = async () => {
	if (idb) return idb
	idb = await openDB<DB>("main", 2, {
		async upgrade(db, oldVersion, newVersion, transaction, event) {
			if (!db.objectStoreNames.contains('exercises')) {
				await updateMeta()
				db.createObjectStore("exercises", {
					keyPath: "id",
					autoIncrement: true,
				});
			}
			if (!db.objectStoreNames.contains('meta')) {
				db.createObjectStore("meta", {
					keyPath: "id",
					// autoIncrement: true,
				})
			}
		},
	});
	return idb
}

export const saveExercise = async (exercise: Exercise) => {
	synced.set(false)
	await idb.put("exercises", { ...exercise });
	await updateMeta()
}

export const clearExersises = async () => {
	synced.set(false)
	await idb.clear("exercises")
}
