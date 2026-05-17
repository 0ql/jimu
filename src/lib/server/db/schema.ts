import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	uuid: text("uuid")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	username: text("username").notNull().unique(),
	passwordHash: text("passwordHash").notNull(),
});

export const exercises = sqliteTable("exercises", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	uuid: text("uuid")
		.notNull()
		.unique()
		.references(() => users.uuid),
	lastModified: integer("last_modified", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
	workoutsJsn: text("workouts_string").notNull(),
});

export const exerciseUpdateLog = sqliteTable("exercises_update_log", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	exerciseId: integer("exercise_id")
		.notNull()
		.references(() => exercises.id),
	action: text("action", { enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
	changedAt: integer("changed_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	changedBy: text("changed_by").references(() => users.uuid),
	// diff: text('diff'), // JSON string of what changed
});

export const routines = sqliteTable("routines", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	uuid: text("uuid")
		.notNull()
		.unique()
		.references(() => users.uuid),
	lastModified: integer("last_modified", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
	routinesJsn: text("routines_json").notNull(),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userUuid: text("user_id")
		.notNull()
		.references(() => users.uuid),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});
