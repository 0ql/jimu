import { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import * as z from "zod/v4";
import { db } from "#lib/server/db/index.js";
import { exercises, routines } from "#lib/server/db/schema.js";
import { datedLines, formatKg, formatWeight, lineStats, parseLine } from "#lib/sets.js";

/**
 * The read-only tools the connector (Claude, ChatGPT) offers. They read the user's data as last synced to
 * the server; nothing here writes.
 */

type Exercise = { id: number; title: string; workoutsString: string; note?: string };
type Routine = { id: number; name: string; exerciseIds: number[] };

const INSTRUCTIONS = `jimu is a strength-training log. Each exercise has a log with one line per training day:
a date (dd.mm., sometimes dd.mm.yy) followed by sets written as weight×reps, e.g.
"24.10. a10x12 30x10 x8 x7 d15x7":
- "30x10" is a working set: 30 kg for 10 reps
- "x8" without a weight repeats the previous weight (here 30 kg × 8)
- "a" marks a warm-up set (not counted in volume), "d" a drop set
- a set with no weight at all is bodyweight
Volume is the sum of weight × reps over working and drop sets. The tools give full dates (YYYY-MM-DD).`;

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

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
	return {
		exercises: parseList<Exercise>(ex?.json).filter((e) => typeof e?.workoutsString === "string"),
		routines: parseList<Routine>(ro?.json),
	};
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const iso = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Every dated line of an exercise with its full date and numbers. */
const days = (exercise: Exercise) =>
	datedLines(exercise.workoutsString).map(({ date, line }) => {
		const { rest, sets } = parseLine(line);
		const { volume, top } = lineStats(sets);
		return {
			date,
			rest,
			volume,
			top: top ? `${formatWeight(top.weight)}×${top.reps}` : null,
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

export const buildServer = (userUuid: string) => {
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
					line: `${e.title} | ${e.note?.trim() || "—"} | ${all.length} | ${last ? `${iso(last.date)} | ${last.rest}` : "never | —"}`,
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
			const header = `${e.title}${e.note?.trim() ? ` (machine setup: ${e.note.trim()})` : ""}: ${all.length} sessions`;
			const lines = all.map(
				(d) =>
					`${iso(d.date)}  ${d.rest || "(no sets)"}  · volume ${formatKg(d.volume)} kg${d.top ? ` · top ${d.top}` : ""}`,
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
					`${key}: ${entries.length} exercise${entries.length === 1 ? "" : "s"}, volume ${formatKg(volume)} kg`,
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

	return server;
};
