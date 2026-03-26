import { openDB, type DBSchema, type IDBPDatabase } from "idb";

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

export const loadDB = async () => {
	if (idb) return idb
	idb = await openDB<DB>("main", 2, {
		upgrade(db, oldVersion, newVersion, transaction, event) {
			if (!db.objectStoreNames.contains('exercises')) {
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
	await idb.put("exercises", { ...exercise });
	await idb.put("meta", { id: 1, lastChanged: Date.now() })
}
