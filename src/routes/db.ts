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
}

export let db: IDBPDatabase<DB>;

export const loadDB = async () => {
	if (db) return db
	db = await openDB<DB>("main", 1, {
		upgrade(db, oldVersion, newVersion, transaction, event) {
			db.createObjectStore("exercises", {
				keyPath: "id",
				autoIncrement: true,
			});
		},
	});
	return db
}
