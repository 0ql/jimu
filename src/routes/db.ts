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

export let idb: IDBPDatabase<DB>;

export const loadDB = async () => {
	if (idb) return idb
	idb = await openDB<DB>("main", 1, {
		upgrade(db, oldVersion, newVersion, transaction, event) {
			db.createObjectStore("exercises", {
				keyPath: "id",
				autoIncrement: true,
			});
		},
	});
	return idb
}
