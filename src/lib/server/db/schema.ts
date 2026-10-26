import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	uuid: text("uuid")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	username: text("username").notNull().unique(),
	passwordHash: text("passwordHash").notNull(),
	isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	/** The unit weights are written in, "kg" or "lb". Only a label: logs aren't converted. */
	unit: text("unit").notNull().default("kg"),
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

/**
 * A user's training splits: routines on a schedule. Stored and synced as one JSON list per
 * user, like routines (see #lib/server/syncStore).
 */
export const splits = sqliteTable("splits", {
	uuid: text("uuid")
		.primaryKey()
		.references(() => users.uuid, { onDelete: "cascade" }),
	lastModified: integer("last_modified", { mode: "timestamp_ms" })
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date()),
	splitsJsn: text("splits_json").notNull(),
});

/** Who is signed in where (the `session` cookie). Not to be confused with training sessions. */
export const loginSessions = sqliteTable("login_sessions", {
	id: text("id").primaryKey(),
	userUuid: text("user_uuid")
		.notNull()
		.references(() => users.uuid),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Apps connected to an account over OAuth (the Claude connector). One row per connection:
 * created with a short-lived authorization code when the user allows access, then holding the
 * current access and refresh token. Every secret is stored as a SHA-256 hash. Deleting the row
 * revokes the connection.
 */
export const oauthGrants = sqliteTable("oauth_grants", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userUuid: text("user_uuid")
		.notNull()
		.references(() => users.uuid, { onDelete: "cascade" }),
	/** The app's client ID: the HTTPS URL of its client metadata document. */
	clientId: text("client_id").notNull(),
	clientName: text("client_name").notNull(),
	redirectUri: text("redirect_uri").notNull(),
	scope: text("scope").notNull(),
	/** The MCP endpoint the tokens are for (RFC 8707 resource). */
	resource: text("resource").notNull(),
	codeHash: text("code_hash").unique(),
	codeChallenge: text("code_challenge"),
	codeExpiresAt: integer("code_expires_at", { mode: "timestamp_ms" }),
	codeUsed: integer("code_used", { mode: "boolean" }).notNull().default(false),
	accessHash: text("access_hash").unique(),
	accessExpiresAt: integer("access_expires_at", { mode: "timestamp_ms" }),
	refreshHash: text("refresh_hash").unique(),
	refreshExpiresAt: integer("refresh_expires_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});
