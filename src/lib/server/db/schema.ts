import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	uuid: text("uuid")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	username: text("username").notNull().unique(),
	passwordHash: text("passwordHash").notNull(),
	isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	// Nullable: accounts created before this column existed have no date.
	createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
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
