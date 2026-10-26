import { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import * as z from "zod/v4";
import { db } from "#lib/server/db/index.js";
import { exercises, routines, splits, users } from "#lib/server/db/schema.js";
import { changeStores } from "#lib/server/syncStore.js";
import { newId } from "#lib/merge.js";
import { datedLines, formatKg, formatSet, lineStats, parseLine } from "#lib/sets.js";
import {
	WEEKDAYS,
	isoDate,
	members,
	newSplit,
	splitStart,
	splitStatus,
	trainedDates,
	type Split,
} from "#lib/splits.js";

/**
 * The tools the connector (Claude, ChatGPT) offers. The read tools see the user's data as last
 * synced to the server. With the "write" scope there are also tools that create and change
 * exercises, routines and splits and log sets; they write through changeStores, so the user's
 * devices merge the changes in like an edit from another device. Nothing here deletes.
 */

type Exercise = {
	id: number;
	title: string;
	workoutsString: string;
	note?: string;
	perSide?: boolean;
};
type Routine = { id: number; name: string; exerciseIds: number[]; trainedOn?: string[] };

const INSTRUCTIONS = `jimu is a strength-training log. Each exercise has a log with one line per training day:
a date (dd.mm., sometimes dd.mm.yy) followed by sets written as weight×reps, e.g.
"24.10. a10x12 30x10 x8 x7 d15x7":
- "30x10" is a working set: 30 (kg or lb, the tools say which) for 10 reps
- "x8" without a weight repeats the previous weight (here 30 × 8)
- "a" marks a warm-up set (not counted in volume), "d" a drop set
- a set with no weight at all is bodyweight; "+10x8" is bodyweight plus 10 added (a dip belt),
  "-20x8" bodyweight with 20 of assistance (machine pull-ups)
- "20x12/11" gives each side its reps (one arm or leg at a time): 12 on the first side, 11 on the second
Volume is the sum of weight × reps over working and drop sets; bodyweight sets count only added
weight. Exercises marked "per side" are logged for one side and their volume counts both. The tools
give full dates (YYYY-MM-DD).
Routines group exercises trained together; splits put routines on a schedule (a rotation every few days
or on set gym days, or a fixed routine per weekday).
If the write tools are available, they create and change exercises, routines and splits and log sets,
but can never delete anything. Refer to exercises, routines and splits by name.`;

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const creates = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: false,
	openWorldHint: false,
} as const;
const updates = {
	readOnlyHint: false,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} as const;

const parseList = <T>(json: string | undefined): T[] => {
	try {
		const value = JSON.parse(json ?? "[]");
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
};

const loadData = async (uuid: string) => {
	const [ex] = await db
		.select({ json: exercises.workoutsJsn })
		.from(exercises)
		.where(eq(exercises.uuid, uuid));
	const [ro] = await db
		.select({ json: routines.routinesJsn })
		.from(routines)
		.where(eq(routines.uuid, uuid));
	const [sp] = await db
		.select({ json: splits.splitsJsn })
		.from(splits)
		.where(eq(splits.uuid, uuid));
	const [user] = await db.select({ unit: users.unit }).from(users).where(eq(users.uuid, uuid));
	return {
		exercises: parseList<Exercise>(ex?.json).filter((e) => typeof e?.workoutsString === "string"),
		routines: parseList<Routine>(ro?.json),
		splits: parseList<Split>(sp?.json),
		/** The account's weight unit, for every number the tools print. */
		unit: user?.unit === "lb" ? "lb" : "kg",
	};
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const iso = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Every dated line of an exercise with its full date and numbers. */
const days = (exercise: Exercise) =>
	datedLines(exercise.workoutsString).map(({ date, line }) => {
		const { rest, sets } = parseLine(line);
		const { volume, top } = lineStats(sets, exercise.perSide);
		return {
			date,
			rest,
			volume,
			top: top ? formatSet(top) : null,
		};
	});

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const problem = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });

/** The exercise a name refers to: an exact match, else the only one containing it. */
const findExercise = (all: Exercise[], name: string) => {
	const wanted = norm(name);
	const exact = all.find((e) => norm(e.title) === wanted);
	if (exact) return { exercise: exact };
	const partial = all.filter((e) => norm(e.title).includes(wanted));
	if (partial.length === 1) return { exercise: partial[0] };
	return { candidates: partial.length ? partial : all };
};

/** A problem the model should read and fix, e.g. an unknown name. Undoes the whole change. */
class ToolError extends Error {}

/** The one item a name refers to (exact, else the only partial match); throws a ToolError. */
const pick = <T>(all: T[], name: string, label: (item: T) => string, kind: string) => {
	const wanted = norm(name);
	const exact = all.filter((item) => norm(label(item)) === wanted);
	if (exact.length === 1) return exact[0];
	const partial = all.filter((item) => norm(label(item)).includes(wanted));
	if (exact.length === 0 && partial.length === 1) return partial[0];
	const options = (exact.length ? exact : partial.length ? partial : all).map(label);
	throw new ToolError(
		`No single ${kind} matches "${name}". ${kind[0].toUpperCase()}${kind.slice(1)}s: ${options.join(", ") || "none"}.`,
	);
};

const nameTaken = <T>(all: T[], name: string, label: (item: T) => string, kind: string) => {
	if (all.some((item) => norm(label(item)) === norm(name)))
		throw new ToolError(
			`There already is ${kind === "exercise" ? "an" : "a"} ${kind} called "${name}".`,
		);
};

const WEEKDAY_NAMES = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

/** The sets of a log line, checked: every token has to be valid log syntax. */
const checkSets = (sets: string) => {
	const tokens = sets.trim().split(/\s+/).filter(Boolean);
	if (!tokens.length) throw new ToolError("No sets given.");
	const invalid = parseLine(`01.01. ${tokens.join(" ")}`).sets.flatMap((s) =>
		s.kind === "invalid" ? [s.token] : [],
	);
	if (invalid.length)
		throw new ToolError(
			`Not valid log syntax: ${invalid.join(", ")}. Write sets like "a10x12 30x10 x8 d15x7".`,
		);
	return tokens.join(" ");
};

/**
 * Adds sets to an exercise's log on a day: to that day's line if there is one, else as a new
 * line in date order. Nothing already logged is changed or removed.
 */
const addToLog = (log: string, date: string, sets: string, now: Date) => {
	const lines = log.split("\n");
	const datedRows = lines.flatMap((line, i) => (parseLine(line).date ? [i] : []));
	const dates = datedLines(log, now).map((d) => isoDate(d.date));
	const same = dates.indexOf(date);
	if (same !== -1) {
		const row = datedRows[same];
		lines[row] = `${lines[row].trimEnd()} ${sets}`;
		return { log: lines.join("\n"), line: lines[row] };
	}
	const [y, m, d] = date.split("-");
	// The year is written out for another year's day; within this year the log's dates are enough.
	const stamp = `${d}.${m}.${Number(y) === now.getFullYear() ? "" : `${y.slice(2)}.`}`;
	const line = `${stamp} ${sets}`;
	const after = dates.findLastIndex((x) => x < date);
	if (after === dates.length - 1) {
		const trimmed = log.replace(/\s+$/, "");
		return { log: `${trimmed}${trimmed ? "\n" : ""}${line}`, line };
	}
	const at = after === -1 ? datedRows[0] : datedRows[after] + 1;
	lines.splice(at, 0, line);
	return { log: lines.join("\n"), line };
};

/** "Rotation · Tue, Wed, Thu, Sat, Sun · keeps the order" and the like. */
const describeSchedule = (split: Split, names: Map<number, string>) => {
	if (split.kind === "weekdays") {
		const days = WEEKDAYS.map(
			(day, i) => `${day} ${split.days[i] === null ? "rest" : (names.get(split.days[i]!) ?? "?")}`,
		);
		return `weekdays (${days.join(", ")}); a missed day is ${split.catchUp ? "caught up on the next rest day" : "skipped"}`;
	}
	const order = split.routineIds.map((id) => names.get(id) ?? "?").join(" → ");
	const pace =
		split.pace === "gym-days"
			? `on ${WEEKDAYS.filter((_, i) => split.gymDays.includes(i)).join(", ") || "no days yet"}`
			: split.everyDays === 1
				? "every day"
				: `every ${split.everyDays} days`;
	return `rotation ${order || "(no routines)"}, ${pace}; a missed day ${split.keepOrder ? "keeps the order" : "keeps the dates"}`;
};

const scheduleInput = {
	kind: z
		.enum(["rotation", "weekdays"])
		.optional()
		.describe("rotation: the routines take turns; weekdays: a fixed routine per weekday"),
	routines: z
		.array(z.string())
		.optional()
		.describe("Rotation: routine names in the order they are trained"),
	every_days: z
		.number()
		.int()
		.min(1)
		.max(7)
		.optional()
		.describe(
			"Rotation: train every this many days (2 = one rest day between). Ignored with gym_days",
		),
	gym_days: z
		.array(z.enum(WEEKDAY_NAMES))
		.optional()
		.describe(
			"Rotation: train only on these weekdays instead of every few days; [] goes back to every few days",
		),
	weekdays: z
		.object(Object.fromEntries(WEEKDAY_NAMES.map((d) => [d, z.string().nullable().optional()])))
		.optional()
		.describe("Weekdays: the routine name for each day; leave a day out or null for a rest day"),
	missed_day: z
		.enum(["keep_order", "keep_dates", "skip", "catch_up"])
		.optional()
		.describe(
			"What happens when a day is missed. Rotation: keep_order (the routine waits) or keep_dates. Weekdays: skip or catch_up (on the next rest day)",
		),
};
type ScheduleInput = {
	kind?: "rotation" | "weekdays";
	routines?: string[];
	every_days?: number;
	gym_days?: (typeof WEEKDAY_NAMES)[number][];
	weekdays?: Record<string, string | null | undefined>;
	missed_day?: "keep_order" | "keep_dates" | "skip" | "catch_up";
};

/** Applies schedule fields to a split; routine names must exist. */
const applySchedule = (split: Split, input: ScheduleInput, all: Routine[]) => {
	const routine = (name: string) => pick(all, name, (r) => r.name, "routine").id;
	if (input.kind) split.kind = input.kind;
	if (input.routines) split.routineIds = [...new Set(input.routines.map(routine))];
	if (input.every_days !== undefined) {
		split.everyDays = input.every_days;
		if (!input.gym_days) split.pace = "interval";
	}
	if (input.gym_days) {
		split.gymDays = [...new Set(input.gym_days.map((d) => WEEKDAY_NAMES.indexOf(d)))].sort(
			(a, b) => a - b,
		);
		split.pace = split.gymDays.length ? "gym-days" : "interval";
	}
	if (input.weekdays) {
		split.days = WEEKDAY_NAMES.map((d) => {
			const name = input.weekdays![d];
			return name ? routine(name) : null;
		});
	}
	if (input.missed_day === "keep_order" || input.missed_day === "keep_dates") {
		if (split.kind !== "rotation")
			throw new ToolError(`${input.missed_day} is for rotations; weekdays use skip or catch_up.`);
		split.keepOrder = input.missed_day === "keep_order";
	}
	if (input.missed_day === "skip" || input.missed_day === "catch_up") {
		if (split.kind !== "weekdays")
			throw new ToolError(
				`${input.missed_day} is for weekdays; rotations use keep_order or keep_dates.`,
			);
		split.catchUp = input.missed_day === "catch_up";
	}
	if (split.kind === "rotation" && !split.routineIds.length)
		throw new ToolError("A rotation needs routines: give them in order with `routines`.");
	if (split.kind === "weekdays" && split.days.every((d) => d === null))
		throw new ToolError(
			"Weekdays need at least one day with a routine: give them with `weekdays`.",
		);
};

export const buildServer = (userUuid: string, canWrite = false) => {
	const server = new McpServer({ name: "jimu", version: "1.0.0" }, { instructions: INSTRUCTIONS });

	server.registerTool(
		"list_exercises",
		{
			title: "List exercises",
			description:
				"Lists the user's exercises with machine setup, number of logged sessions, the last training date and that day's sets. Optionally only the exercises of one routine (e.g. 'Push').",
			inputSchema: z.object({
				routine: z.string().optional().describe("Only exercises in this routine (by name)"),
			}),
			annotations: readOnly,
		},
		async ({ routine }) => {
			const data = await loadData(userUuid);
			let list = data.exercises;
			if (routine) {
				const r = data.routines.find((x) => norm(x.name) === norm(routine));
				if (!r)
					return problem(
						`No routine called "${routine}". Routines: ${data.routines.map((x) => x.name).join(", ") || "none"}.`,
					);
				const order = new Map(r.exerciseIds.map((id, i) => [id, i]));
				list = list
					.filter((e) => order.has(e.id))
					.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
			}
			if (!list.length) return text("No exercises yet.");
			const rows = list.map((e) => {
				const all = days(e);
				const last = all.at(-1);
				return {
					line: `${e.title}${e.perSide ? " (per side)" : ""} | ${e.note?.trim() || "—"} | ${all.length} | ${last ? `${iso(last.date)} | ${last.rest}` : "never | —"}`,
					time: last?.date.getTime() ?? 0,
				};
			});
			if (!routine) rows.sort((a, b) => b.time - a.time);
			return text(
				`${list.length} exercises${routine ? ` in ${routine} (routine order)` : " (most recently trained first)"}.\n` +
					`name | machine setup | sessions | last trained | last entry\n` +
					rows.map((r) => r.line).join("\n"),
			);
		},
	);

	server.registerTool(
		"get_exercise_log",
		{
			title: "Get an exercise's log",
			description:
				"The full training log of one exercise: every training day with its date, sets, volume and top set. Use the exercise name as listed by list_exercises (case-insensitive; part of the name works if it's unique).",
			inputSchema: z.object({ exercise: z.string().describe("Exercise name") }),
			annotations: readOnly,
		},
		async ({ exercise: name }) => {
			const data = await loadData(userUuid);
			const found = findExercise(data.exercises, name);
			if (!found.exercise)
				return problem(
					`No single exercise matches "${name}". Exercises: ${found.candidates.map((e) => e.title).join(", ") || "none"}.`,
				);
			const e = found.exercise;
			const all = days(e);
			const header = `${e.title}${e.note?.trim() ? ` (machine setup: ${e.note.trim()})` : ""}${e.perSide ? " (per side: one side logged, volume counts both)" : ""}: ${all.length} sessions, weights in ${data.unit}`;
			const lines = all.map(
				(d) =>
					`${iso(d.date)}  ${d.rest || "(no sets)"}  · volume ${formatKg(d.volume)} ${data.unit}${d.top ? ` · top ${d.top}` : ""}`,
			);
			return text([header, "", ...lines].join("\n"));
		},
	);

	server.registerTool(
		"get_sessions",
		{
			title: "Get training sessions",
			description:
				"Training days across all exercises, newest first: which exercises were done each day, their sets and the day's volume. Defaults to the 14 most recent days; narrow it with from/to dates.",
			inputSchema: z.object({
				from: z.iso.date().optional().describe("First day to include, YYYY-MM-DD"),
				to: z.iso.date().optional().describe("Last day to include, YYYY-MM-DD"),
				limit: z
					.number()
					.int()
					.min(1)
					.max(366)
					.optional()
					.describe("Most recent days to return (default 14)"),
			}),
			annotations: readOnly,
		},
		async ({ from, to, limit }) => {
			const data = await loadData(userUuid);
			const byDay = new Map<string, { title: string; rest: string; volume: number }[]>();
			for (const e of data.exercises) {
				for (const d of days(e)) {
					const key = iso(d.date);
					if ((from && key < from) || (to && key > to)) continue;
					if (!byDay.has(key)) byDay.set(key, []);
					byDay.get(key)!.push({ title: e.title, rest: d.rest, volume: d.volume });
				}
			}
			const keys = [...byDay.keys()]
				.sort()
				.reverse()
				.slice(0, limit ?? 14);
			if (!keys.length) return text("No training days in that range.");
			const blocks = keys.map((key) => {
				const entries = byDay.get(key)!.sort((a, b) => a.title.localeCompare(b.title));
				const volume = entries.reduce((sum, x) => sum + x.volume, 0);
				return [
					`${key}: ${entries.length} exercise${entries.length === 1 ? "" : "s"}, volume ${formatKg(volume)} ${data.unit}`,
					...entries.map((x) => `  ${x.title}: ${x.rest || "(no sets)"}`),
				].join("\n");
			});
			return text(blocks.join("\n\n"));
		},
	);

	server.registerTool(
		"list_routines",
		{
			title: "List routines",
			description:
				"The user's routines (e.g. push/pull/legs) with their exercises in training order.",
			inputSchema: z.object({}),
			annotations: readOnly,
		},
		async () => {
			const data = await loadData(userUuid);
			if (!data.routines.length) return text("No routines yet.");
			const names = new Map(data.exercises.map((e) => [e.id, e.title]));
			return text(
				data.routines
					.map(
						(r) =>
							`${r.name}: ${
								r.exerciseIds
									.map((id) => names.get(id))
									.filter(Boolean)
									.join(", ") || "(empty)"
							}`,
					)
					.join("\n"),
			);
		},
	);

	server.registerTool(
		"list_splits",
		{
			title: "List splits",
			description:
				"The user's splits: routines on a schedule, with what is due next and the plan for the coming week.",
			inputSchema: z.object({}),
			annotations: readOnly,
		},
		async () => {
			const data = await loadData(userUuid);
			if (!data.splits.length) return text("No splits yet.");
			const names = new Map(data.routines.map((r) => [r.id, r.name]));
			const trained = trainedDates(data);
			const today = isoDate();
			return text(
				data.splits
					.map((split) => {
						const status = splitStatus(split, trained, today, 7);
						const next = status.next
							? `${names.get(status.next.routineId)} on ${status.next.date}${status.next.overdue ? " (overdue)" : ""}`
							: "nothing planned";
						const week = status.days
							.filter((d) => d.routineId !== null)
							.map((d) => `${d.date} ${names.get(d.routineId!)}${d.done ? " (done)" : ""}`)
							.join(", ");
						return `${split.name}: ${describeSchedule(split, names)}\n  next: ${next}\n  this week: ${week || "rest"}`;
					})
					.join("\n\n"),
			);
		},
	);

	if (!canWrite) return server;

	/** Runs a change in one transaction; a ToolError comes back to the model and nothing is saved. */
	const change = (
		stores: ("exercises" | "routines" | "splits")[],
		edit: (lists: { exercises: Exercise[]; routines: Routine[]; splits: Split[] }) => string,
	) => {
		try {
			return text(
				changeStores(userUuid, stores, (lists) =>
					edit(lists as unknown as { exercises: Exercise[]; routines: Routine[]; splits: Split[] }),
				),
			);
		} catch (error) {
			if (error instanceof ToolError) return problem(error.message);
			throw error;
		}
	};
	const exerciseNamed = (all: Exercise[], name: string) =>
		pick(all, name, (e) => e.title, "exercise");
	const routineNamed = (all: Routine[], name: string) => pick(all, name, (r) => r.name, "routine");

	server.registerTool(
		"create_exercise",
		{
			title: "Create an exercise",
			description:
				"Adds a new exercise with an empty log. Optionally its machine setup (e.g. 'Sitz 3, Rolle 2') and whether it is trained one side at a time.",
			inputSchema: z.object({
				name: z.string().min(1).max(80).describe("Exercise name"),
				setup: z.string().max(120).optional().describe("Machine setup"),
				per_side: z
					.boolean()
					.optional()
					.describe("Trained one arm or leg at a time: one side is logged, volume counts both"),
			}),
			annotations: creates,
		},
		async ({ name, setup, per_side }) =>
			change(["exercises"], ({ exercises }) => {
				nameTaken(exercises, name, (e) => e.title, "exercise");
				exercises.push({
					id: newId(),
					title: name.trim(),
					workoutsString: "",
					...(setup?.trim() ? { note: setup.trim() } : {}),
					...(per_side ? { perSide: true } : {}),
				});
				return `Created the exercise "${name.trim()}".`;
			}),
	);

	server.registerTool(
		"update_exercise",
		{
			title: "Rename an exercise or change its setup",
			description:
				"Changes an exercise's name, machine setup (an empty setup clears it) and/or whether it is trained per side. The log is not touched; add sets with log_sets.",
			inputSchema: z.object({
				exercise: z.string().describe("Current exercise name"),
				name: z.string().min(1).max(80).optional().describe("New name"),
				setup: z.string().max(120).optional().describe("New machine setup"),
				per_side: z
					.boolean()
					.optional()
					.describe("Trained one arm or leg at a time: one side is logged, volume counts both"),
			}),
			annotations: updates,
		},
		async ({ exercise, name, setup, per_side }) =>
			change(["exercises"], ({ exercises }) => {
				const e = exerciseNamed(exercises, exercise);
				if (name && norm(name) !== norm(e.title)) {
					nameTaken(exercises, name, (x) => x.title, "exercise");
					e.title = name.trim();
				}
				if (setup !== undefined) {
					if (setup.trim()) e.note = setup.trim();
					else delete e.note;
				}
				if (per_side !== undefined) {
					if (per_side) e.perSide = true;
					else delete e.perSide;
				}
				return `Updated "${e.title}"${e.note ? ` (setup: ${e.note})` : ""}${e.perSide ? " (per side)" : ""}.`;
			}),
	);

	server.registerTool(
		"log_sets",
		{
			title: "Log sets",
			description:
				"Adds sets to an exercise's log for a day, in the log syntax (e.g. 'a10x12 30x10 x8 d15x7'). They are added to that day's line, or a new line is made; nothing logged before is changed. Name the routine being trained to count the day for it (so splits know it was done).",
			inputSchema: z.object({
				exercise: z.string().describe("Exercise name"),
				sets: z.string().min(1).describe("Sets in log syntax, e.g. 'a10x12 30x10 x8 x7'"),
				date: z.iso.date().optional().describe("The training day, YYYY-MM-DD; defaults to today"),
				routine: z.string().optional().describe("The routine being trained, if any"),
			}),
			annotations: creates,
		},
		async ({ exercise, sets, date, routine }) =>
			change(["exercises", "routines"], ({ exercises, routines }) => {
				const now = new Date();
				const day = date ?? isoDate(now);
				if (day > isoDate(now)) throw new ToolError("That date is in the future.");
				const e = exerciseNamed(exercises, exercise);
				const result = addToLog(e.workoutsString, day, checkSets(sets), now);
				e.workoutsString = result.log;
				let counted = "";
				if (routine) {
					const r = routineNamed(routines, routine);
					r.trainedOn = [...new Set([...(r.trainedOn ?? []), day])].sort();
					counted = ` Counted ${day} for ${r.name}.`;
				}
				return `Logged ${e.title} on ${day}: "${result.line}".${counted}`;
			}),
	);

	server.registerTool(
		"create_routine",
		{
			title: "Create a routine",
			description: "Adds a routine: exercises trained together in one session, in training order.",
			inputSchema: z.object({
				name: z.string().min(1).max(60).describe("Routine name, e.g. 'Push'"),
				exercises: z.array(z.string()).describe("Exercise names in training order"),
			}),
			annotations: creates,
		},
		async ({ name, exercises: wanted }) =>
			change(["exercises", "routines"], ({ exercises, routines }) => {
				nameTaken(routines, name, (r) => r.name, "routine");
				const ids = [...new Set(wanted.map((x) => exerciseNamed(exercises, x).id))];
				routines.push({ id: newId(), name: name.trim(), exerciseIds: ids });
				return `Created the routine "${name.trim()}" with ${ids.length} exercise${ids.length === 1 ? "" : "s"}.`;
			}),
	);

	server.registerTool(
		"update_routine",
		{
			title: "Change a routine",
			description:
				"Renames a routine and/or sets its exercises. `exercises` is the complete list in training order: an exercise left out is taken out of the routine (the exercise itself stays).",
			inputSchema: z.object({
				routine: z.string().describe("Current routine name"),
				name: z.string().min(1).max(60).optional().describe("New name"),
				exercises: z.array(z.string()).optional().describe("All exercise names, in training order"),
			}),
			annotations: updates,
		},
		async ({ routine, name, exercises: wanted }) =>
			change(["exercises", "routines"], ({ exercises, routines }) => {
				const r = routineNamed(routines, routine);
				if (name && norm(name) !== norm(r.name)) {
					nameTaken(routines, name, (x) => x.name, "routine");
					r.name = name.trim();
				}
				if (wanted) r.exerciseIds = [...new Set(wanted.map((x) => exerciseNamed(exercises, x).id))];
				const titles = new Map(exercises.map((e) => [e.id, e.title]));
				return `${r.name}: ${r.exerciseIds.map((id) => titles.get(id)).join(", ") || "(empty)"}.`;
			}),
	);

	server.registerTool(
		"create_split",
		{
			title: "Create a split",
			description:
				"Puts routines on a schedule. A rotation trains its routines in turn, every few days (every_days) or on set weekdays (gym_days); weekdays gives each weekday a routine or a rest day.",
			inputSchema: z.object({
				name: z.string().min(1).max(60).describe("Split name, e.g. 'PPL'"),
				...scheduleInput,
				kind: scheduleInput.kind.unwrap(),
			}),
			annotations: creates,
		},
		async ({ name, ...schedule }) =>
			change(["exercises", "routines", "splits"], ({ exercises, routines, splits }) => {
				nameTaken(splits, name, (x) => x.name, "split");
				const today = isoDate();
				const split: Split = { ...newSplit(today), name: name.trim() };
				applySchedule(split, schedule, routines);
				split.start = splitStart(split, null, trainedDates({ routines, exercises }), today);
				split.id = newId();
				splits.push(split);
				const names = new Map(routines.map((r) => [r.id, r.name]));
				return `Created the split "${split.name}": ${describeSchedule(split, names)}.`;
			}),
	);

	server.registerTool(
		"update_split",
		{
			title: "Change a split",
			description:
				"Renames a split and/or changes its schedule; only the fields given change. `routines` is the complete rotation order; `weekdays` the complete week.",
			inputSchema: z.object({
				split: z.string().describe("Current split name"),
				name: z.string().min(1).max(60).optional().describe("New name"),
				...scheduleInput,
			}),
			annotations: updates,
		},
		async ({ split: which, name, ...schedule }) =>
			change(["exercises", "routines", "splits"], ({ exercises, routines, splits }) => {
				const split = pick(splits, which, (x) => x.name, "split");
				const original: Split = structuredClone(split);
				if (name && norm(name) !== norm(split.name)) {
					nameTaken(splits, name, (x) => x.name, "split");
					split.name = name.trim();
				}
				// Older splits may predate the gym-days fields.
				split.pace ??= "interval";
				split.gymDays ??= [];
				applySchedule(split, schedule, routines);
				split.start = splitStart(split, original, trainedDates({ routines, exercises }), isoDate());
				const names = new Map(routines.map((r) => [r.id, r.name]));
				return `Updated the split "${split.name}": ${describeSchedule(split, names)}.`;
			}),
	);

	return server;
};
