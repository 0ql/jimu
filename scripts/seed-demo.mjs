/**
 * Creates a demo account with about a year of realistic training, for trying the app out and
 * for screenshots. Run against a development database:
 *
 *   DATABASE_URL=./local.db node scripts/seed-demo.mjs
 *
 * The account is "demo" with the password below (or DEMO_USERNAME / DEMO_PASSWORD). An existing
 * account of that name is left alone unless --replace is passed, which deletes it and its data
 * first. The training is generated from a fixed seed, so every run produces the same history,
 * ending yesterday.
 *
 * The year: an Upper/Lower phase on four weekdays (Nov–Feb), then a Push/Pull/Legs rotation on
 * Tue, Wed, Thu, Sat and Sun (Mar–now), with double progression, the odd bad day, a holiday
 * break, a sick week, a summer vacation and some missed days.
 */
import Database from "better-sqlite3";
import argon2 from "@node-rs/argon2";
import { randomUUID } from "node:crypto";

const USERNAME = process.env.DEMO_USERNAME ?? "demo";
const PASSWORD = process.env.DEMO_PASSWORD ?? "jimu-demo-2026";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Set DATABASE_URL to the SQLite file, e.g. ./local.db");

// ---------------------------------------------------------------- deterministic randomness
let seed = 20261026;
const random = () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};
const chance = (p) => random() < p;
const between = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

// ---------------------------------------------------------------- dates (local days)
const day = (y, m, d) => new Date(y, m - 1, d);
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const iso = (d) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const stamp = (d) =>
	`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
const weekday = (d) => (d.getDay() + 6) % 7; // 0 = Monday

const today = new Date();
today.setHours(0, 0, 0, 0);
const START = addDays(today, -364);
const PPL_START = addDays(today, -237); // about eight months ago
const off = [
	// Christmas and New Year, a sick week in February, a summer vacation.
	[day(today.getFullYear() - 1, 12, 22), day(today.getFullYear(), 1, 4)],
	[day(today.getFullYear(), 2, 9), day(today.getFullYear(), 2, 15)],
	[day(today.getFullYear(), 8, 10), day(today.getFullYear(), 8, 21)],
];
const isOff = (d) => off.some(([from, to]) => d >= from && d <= to);

// ---------------------------------------------------------------- exercises
// kind: "weight" (plain), "bodyweight" (reps first, then weight added with +), per side ones are
// logged for one side. pace: how often a session adds a rep (dumbbell work climbs slower).
const EXERCISES = {
	squat: {
		title: "Squat",
		start: 80,
		inc: 2.5,
		lo: 5,
		hi: 8,
		sets: 3,
		warmups: [
			[40, 10],
			[60, 5],
		],
	},
	bench: { title: "Bench press", start: 60, inc: 2.5, lo: 6, hi: 10, sets: 3, warmups: [[40, 10]] },
	row: { title: "Barbell row", start: 55, inc: 2.5, lo: 8, hi: 12, sets: 3, warmups: [[40, 10]] },
	ohp: {
		title: "Overhead press",
		start: 37.5,
		inc: 2.5,
		lo: 6,
		hi: 10,
		sets: 3,
		warmups: [[20, 10]],
	},
	pulldown: {
		title: "Lat pulldown",
		note: "Thigh pad 3",
		start: 50,
		inc: 2.5,
		lo: 8,
		hi: 12,
		sets: 3,
	},
	curl: {
		title: "Cable biceps curl",
		start: 20,
		inc: 2.5,
		lo: 10,
		hi: 15,
		sets: 3,
		drop: 0.3,
		pace: 0.5,
	},
	pushdown: { title: "Triceps pushdown", start: 25, inc: 2.5, lo: 10, hi: 15, sets: 3, drop: 0.3 },
	rdl: {
		title: "Romanian deadlift",
		start: 70,
		inc: 2.5,
		lo: 8,
		hi: 12,
		sets: 3,
		warmups: [[40, 10]],
	},
	legpress: {
		title: "Leg press",
		note: "Seat 4",
		start: 120,
		inc: 10,
		lo: 10,
		hi: 15,
		sets: 3,
		warmups: [[60, 15]],
	},
	legcurl: {
		title: "Leg curl",
		note: "Seat 5, pad 2",
		start: 35,
		inc: 2.5,
		lo: 10,
		hi: 15,
		sets: 3,
	},
	calf: { title: "Calf raise", start: 60, inc: 5, lo: 12, hi: 20, sets: 3 },
	incline: {
		title: "Incline dumbbell press",
		start: 22.5,
		inc: 2.5,
		lo: 8,
		hi: 12,
		sets: 3,
		pace: 0.4,
	},
	lateral: {
		title: "Lateral raise",
		start: 8,
		inc: 1,
		lo: 12,
		hi: 20,
		sets: 3,
		drop: 0.4,
		pace: 0.5,
	},
	dips: { title: "Dips", kind: "bodyweight", start: 0, inc: 2.5, lo: 8, hi: 12, sets: 3 },
	pullups: { title: "Pull-ups", kind: "bodyweight", start: 0, inc: 2.5, lo: 5, hi: 9, sets: 3 },
	dbrow: {
		title: "Single-arm dumbbell row",
		perSide: true,
		start: 22.5,
		inc: 2.5,
		lo: 10,
		hi: 12,
		sets: 3,
		pace: 0.35,
	},
	split: {
		title: "Bulgarian split squat",
		perSide: true,
		start: 12.5,
		inc: 2.5,
		lo: 8,
		hi: 12,
		sets: 3,
		pace: 0.45,
	},
	facepull: { title: "Face pull", start: 15, inc: 2.5, lo: 12, hi: 20, sets: 3 },
};

const ROUTINES = {
	upper: { name: "Upper", exercises: ["bench", "row", "ohp", "pulldown", "curl", "pushdown"] },
	lower: { name: "Lower", exercises: ["squat", "rdl", "legpress", "legcurl", "calf"] },
	push: { name: "Push", exercises: ["bench", "incline", "ohp", "lateral", "dips", "pushdown"] },
	pull: { name: "Pull", exercises: ["pullups", "row", "dbrow", "facepull", "curl"] },
	legs: { name: "Legs", exercises: ["squat", "rdl", "split", "legcurl", "calf"] },
};

// ---------------------------------------------------------------- the schedule
const sessions = []; // { date, routine }
let rotation = 0;
for (let d = START; d < today; d = addDays(d, 1)) {
	if (isOff(d)) continue;
	if (d < PPL_START) {
		// Upper/Lower: Monday and Thursday upper, Tuesday and Friday lower.
		const plan = { 0: "upper", 1: "lower", 3: "upper", 4: "lower" }[weekday(d)];
		if (plan && !chance(0.08)) sessions.push({ date: d, routine: plan });
	} else if ([1, 2, 3, 5, 6].includes(weekday(d))) {
		// Push, Pull, Legs in turn on the gym days; a missed day keeps the order.
		if (chance(0.08)) continue;
		sessions.push({ date: d, routine: ["push", "pull", "legs"][rotation++ % 3] });
	}
}

// ---------------------------------------------------------------- double progression
const state = Object.fromEntries(
	Object.entries(EXERCISES).map(([key, e]) => [key, { weight: e.start, reps: e.lo, last: null }]),
);
const roundTo = (x, step) => Math.round(x / step) * step;
const fmt = (x) => String(Math.round(x * 100) / 100);
const logs = Object.fromEntries(Object.keys(EXERCISES).map((key) => [key, []]));

for (const { date, routine } of sessions) {
	for (const key of ROUTINES[routine].exercises) {
		const e = EXERCISES[key];
		const s = state[key];
		// Now and then an accessory is skipped when time runs short.
		if (!["squat", "bench", "row", "rdl", "pullups", "ohp"].includes(key) && chance(0.05)) continue;
		// Back after a break of two weeks or more: a little lighter.
		if (s.last && (date - s.last) / 86400000 >= 14 && s.weight > 0) {
			s.weight = Math.max(e.kind === "bodyweight" ? 0 : e.inc, roundTo(s.weight * 0.95, e.inc));
			s.reps = e.lo;
		}
		const badDay = chance(0.06);
		const reps = Array.from({ length: e.sets }, (_, i) =>
			Math.max(1, s.reps - (i === 0 ? 0 : between(0, i)) - (badDay ? 2 : 0)),
		);

		const tokens = (e.warmups ?? []).map(([w, r]) => `a${fmt(w)}x${r}`);
		const weightText = (w) => (e.kind === "bodyweight" ? (w > 0 ? `+${fmt(w)}` : "") : fmt(w));
		reps.forEach((r, i) => {
			// Per side: sometimes the second side manages one rep fewer.
			const sides = e.perSide && chance(0.3) ? `/${r - 1}` : "";
			tokens.push(`${i === 0 ? weightText(s.weight) : ""}x${r}${sides}`);
		});
		if (e.drop && chance(e.drop)) {
			tokens.push(`d${fmt(Math.max(e.inc, roundTo(s.weight * 0.6, e.inc)))}x${between(8, 12)}`);
		}
		logs[key].push(`${stamp(date)} ${tokens.join(" ")}`);

		// First set at the top of the range and the last one close: add weight. Otherwise a rep
		// more, most of the time.
		if (!badDay && reps[0] >= e.hi && reps.at(-1) >= e.hi - 2) {
			s.weight += e.inc;
			s.reps = e.lo;
		} else if (!badDay && chance(e.pace ?? 0.75)) {
			s.reps = Math.min(e.hi, s.reps + 1);
		}
		s.last = date;
	}
}

// ---------------------------------------------------------------- the stored lists
let nextId = Math.floor(START.getTime() / 1000) * 1000;
const newId = () => (nextId += between(1000, 9000));

const exerciseIds = {};
const exercises = Object.entries(EXERCISES).map(([key, e]) => {
	exerciseIds[key] = newId();
	return {
		id: exerciseIds[key],
		title: e.title,
		workoutsString: logs[key].join("\n"),
		...(e.note ? { note: e.note } : {}),
		...(e.perSide ? { perSide: true } : {}),
	};
});

const routineIds = {};
const routines = Object.entries(ROUTINES).map(([key, r]) => {
	routineIds[key] = newId();
	// Nearly every session was logged with its routine's filter on, so it counted.
	const trainedOn = sessions
		.filter((s) => s.routine === key && !chance(0.04))
		.map((s) => iso(s.date));
	return {
		id: routineIds[key],
		name: r.name,
		exerciseIds: r.exercises.map((x) => exerciseIds[x]),
		trainedOn,
	};
});

const splits = [
	{
		id: newId(),
		name: "PPL",
		kind: "rotation",
		routineIds: [routineIds.push, routineIds.pull, routineIds.legs],
		pace: "gym-days",
		everyDays: 2,
		gymDays: [1, 2, 3, 5, 6],
		keepOrder: true,
		days: [null, null, null, null, null, null, null],
		catchUp: false,
		start: iso(PPL_START),
	},
];

// ---------------------------------------------------------------- write
const db = new Database(DATABASE_URL);
db.pragma("foreign_keys = ON");
const existing = db.prepare("select uuid from users where username = ?").get(USERNAME);
if (existing && !process.argv.includes("--replace")) {
	console.log(`"${USERNAME}" already exists. Run with --replace to recreate it.`);
	process.exit(1);
}

const passwordHash = await argon2.hash(PASSWORD);
const uuid = randomUUID();
const now = Date.now();
db.transaction(() => {
	if (existing) {
		for (const table of ["exercises", "routines", "splits", "login_sessions", "oauth_grants"]) {
			const column = table === "login_sessions" || table === "oauth_grants" ? "user_uuid" : "uuid";
			db.prepare(`delete from ${table} where ${column} = ?`).run(existing.uuid);
		}
		db.prepare("delete from users where uuid = ?").run(existing.uuid);
	}
	db.prepare(
		"insert into users (uuid, username, passwordHash, is_admin, created_at, unit) values (?, ?, ?, 0, ?, 'kg')",
	).run(uuid, USERNAME, passwordHash, START.getTime());
	db.prepare("insert into exercises (uuid, last_modified, workouts_string) values (?, ?, ?)").run(
		uuid,
		now,
		JSON.stringify(exercises),
	);
	db.prepare("insert into routines (uuid, last_modified, routines_json) values (?, ?, ?)").run(
		uuid,
		now,
		JSON.stringify(routines),
	);
	db.prepare("insert into splits (uuid, last_modified, splits_json) values (?, ?, ?)").run(
		uuid,
		now,
		JSON.stringify(splits),
	);
})();

const lines = exercises.reduce(
	(n, e) => n + e.workoutsString.split("\n").filter(Boolean).length,
	0,
);
console.log(
	`Created "${USERNAME}": ${sessions.length} sessions from ${iso(START)} to ${iso(sessions.at(-1).date)}, ` +
		`${exercises.length} exercises (${lines} log lines), ${routines.length} routines, ${splits.length} split.`,
);
