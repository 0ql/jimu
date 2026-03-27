// import { drizzle } from 'drizzle-orm/better-sqlite3';
// import Database from 'better-sqlite3';
import * as schema from './schema';
// import { env } from '$env/dynamic/private';

// if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// const client = new Database(env.DATABASE_URL);

// export const db = drizzle(client, { schema });


// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

function createDb() {
	const url = process.env.DATABASE_URL;
	console.log("================================================")
	console.log(url)
	if (!url) return null;
	return drizzle(new Database(url), { schema });
}

export const db = createDb();
