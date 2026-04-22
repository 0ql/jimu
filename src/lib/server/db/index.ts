// import { drizzle } from 'drizzle-orm/better-sqlite3';
// import Database from 'better-sqlite3';
import * as schema from './schema';
import 'dotenv/config'
// import { env } from '$env/dynamic/private';

// if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// const client = new Database(env.DATABASE_URL);

// export const db = drizzle(client, { schema });


// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const createDb = () => {
	const url = process.env.DATABASE_URL;
	console.log("================================================")
	console.log("DATABASE_URL is set to: ", url)
	console.log("================================================")
	if (!url) throw new Error("No DATABASE_URL set.");
	return drizzle(new Database(url), { schema });
}

export const db = createDb();
