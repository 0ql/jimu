/**
 * Splits: routines on a schedule, either a rotation (in order, every few days or on set gym
 * days) or a fixed routine per weekday. Nothing about progress is stored: what is due when is worked out from the dates a
 * routine was trained on (`trainedOn`, set when logging with that routine's filter on) and the
 * exercise logs, so it can never disagree with what was actually logged.
 *
 * Dates are "YYYY-MM-DD" strings in local time; the maths below runs in UTC so a daylight
 * saving switch never makes a day 23 or 25 hours long.
 */
import { datedLines, parseLine } from "./sets";

export type Split = {
	id?: number;
	name: string;
	kind: "rotation" | "weekdays";
	/** Rotation: the routines in the order they are trained. */
	routineIds: number[];
	/** Rotation: train every few days ("interval") or on set weekdays ("gym-days"). */
	pace: "interval" | "gym-days";
	/** Rotation by interval: a session every this many days (2 = one rest day between sessions). */
	everyDays: number;
	/** Rotation on gym days: the weekdays you train, 0 = Monday … 6 = Sunday, sorted. */
	gymDays: number[];
	/** Rotation, when a day is missed: true waits with the next routine, false keeps the dates. */
	keepOrder: boolean;
	/** Weekdays: Monday to Sunday, a routine id or null for a rest day. */
	days: (number | null)[];
	/** Weekdays, when a day is missed: true moves it to the next rest day, false skips it. */
	catchUp: boolean;
	/** The day the split began: a rotation that keeps its dates counts from here. */
	start: string;
};

export type PlanDay = {
	date: string;
	routineId: number | null;
	done: boolean;
	/** Weekdays with catch-up: a missed routine moved onto this rest day. */
	moved?: boolean;
};

export type SplitStatus = {
	/** The next routine still to train, today or later. */
	next: { routineId: number; date: string; overdue: boolean } | null;
	/** Today and the days after it. */
	days: PlanDay[];
};

/** Routines and exercises as far as the schedule needs them. */
export type TrainingData = {
	routines: { id?: number; exerciseIds: number[]; trainedOn?: string[] }[];
	exercises: { id?: number; workoutsString: string }[];
};

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (d = new Date()) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toUtc = (iso: string) => {
	const [y, m, d] = iso.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => {
	const d = new Date(ms);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * DAY_MS);
export const daysBetween = (from: string, to: string) =>
	Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
/** 0 = Monday … 6 = Sunday. */
export const weekday = (iso: string) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "27.10." */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** "today", "tomorrow", a weekday within the coming week, else the date. */
export const relativeDay = (iso: string, today: string) => {
	const days = daysBetween(today, iso);
	if (days === 0) return "today";
	if (days === 1) return "tomorrow";
	if (days > 1 && days < 7) return WEEKDAYS[weekday(iso)];
	return dayMonth(iso);
};

export const newSplit = (today: string): Split => ({
	name: "",
	kind: "rotation",
	routineIds: [],
	pace: "interval",
	everyDays: 2,
	gymDays: [],
	keepOrder: true,
	days: [null, null, null, null, null, null, null],
	catchUp: false,
	start: today,
});

/** The routines a split uses, in order: a rotation's list, or the weekdays' Monday first. */
export const members = (split: Split) =>
	split.kind === "rotation"
		? [...new Set(split.routineIds)]
		: [...new Set(split.days.filter((id) => id !== null))];

/**
 * For each routine, the days it counts as trained, oldest first: days tagged in `trainedOn`
 * on which at least one of its exercises has a logged set. Deleting a day's lines un-trains it.
 */
export const trainedDates = ({ routines, exercises }: TrainingData, now = new Date()) => {
	const logged = new Map<number, Set<string>>();
	for (const exercise of exercises) {
		const dates = new Set<string>();
		for (const { date, line } of datedLines(exercise.workoutsString, now)) {
			if (parseLine(line).sets.some((s) => s.kind !== "invalid")) dates.add(isoDate(date));
		}
		logged.set(exercise.id!, dates);
	}
	const result = new Map<number, string[]>();
	for (const routine of routines) {
		const dates = (routine.trainedOn ?? []).filter((date) =>
			routine.exerciseIds.some((id) => logged.get(id)?.has(date)),
		);
		result.set(routine.id!, [...new Set(dates)].sort());
	}
	return result;
};

/** The last day (up to today) a routine was trained, or null. */
export const lastTrained = (trained: Map<number, string[]>, routineId: number, today: string) =>
	(trained.get(routineId) ?? []).filter((d) => d <= today).at(-1) ?? null;

const wasTrained = (trained: Map<number, string[]>, routineId: number, date: string) =>
	trained.get(routineId)?.includes(date) ?? false;

const trainedBetween = (
	trained: Map<number, string[]>,
	routineId: number,
	from: string,
	to: string,
) => (trained.get(routineId) ?? []).some((d) => d >= from && d <= to);

/** What is due when, for `length` days starting today. */
export const splitStatus = (
	split: Split,
	trained: Map<number, string[]>,
	today: string,
	length = 14,
): SplitStatus => {
	const window = Array.from({ length }, (_, i) => addDays(today, i));
	const plan = (routineFor: (date: string, i: number) => number | null): PlanDay[] =>
		window.map((date, i) => {
			const routineId = routineFor(date, i);
			return { date, routineId, done: routineId !== null && wasTrained(trained, routineId, date) };
		});

	let days: PlanDay[];
	let overdueFrom: string | null = null;

	if (split.kind === "rotation") {
		const order = members(split);
		const every = Math.max(1, Math.round(split.everyDays));
		const onGymDays = split.pace === "gym-days";
		const gym = new Set(split.gymDays);
		if (order.length === 0 || (onGymDays && gym.size === 0)) {
			days = plan(() => null);
		} else if (split.keepOrder) {
			// The order never skips: whatever was trained last, the one after it is next, due
			// `every` days later or on the next gym day. A missed day just waits: it is due today
			// (or on the next gym day) until it's done.
			let last: { index: number; date: string } | null = null;
			for (const [index, id] of order.entries()) {
				const date = lastTrained(trained, id, today);
				if (date && (!last || date >= last.date)) last = { index, date };
			}
			const found = last;
			const nextIndex = found ? (found.index + 1) % order.length : 0;
			const nextGymDay = (from: string) => {
				let date = from;
				while (!gym.has(weekday(date))) date = addDays(date, 1);
				return date;
			};
			let due = onGymDays
				? nextGymDay(found ? addDays(found.date, 1) : split.start)
				: found
					? addDays(found.date, every)
					: split.start;
			if (due < today) {
				overdueFrom = due;
				due = onGymDays ? nextGymDay(today) : today;
			}
			let session = 0;
			days = plan((date) => {
				if (found && date === found.date) return order[found.index];
				if (date < due) return null;
				if (onGymDays ? !gym.has(weekday(date)) : daysBetween(due, date) % every !== 0) return null;
				return order[(nextIndex + session++) % order.length];
			});
		} else if (onGymDays) {
			// Fixed dates: the gym days since the start take turns; a missed one is simply gone.
			const perWeek = gym.size;
			const gymDaysBefore = (date: string) => {
				const span = daysBetween(split.start, date);
				let count = Math.floor(span / 7) * perWeek;
				for (let i = span - (span % 7); i < span; i++) {
					if (gym.has(weekday(addDays(split.start, i)))) count++;
				}
				return count;
			};
			days = plan((date) => {
				if (date < split.start || !gym.has(weekday(date))) return null;
				return order[gymDaysBefore(date) % order.length];
			});
		} else {
			// Fixed dates counted from the start; a missed one is simply gone.
			days = plan((date) => {
				const k = daysBetween(split.start, date);
				if (k < 0 || k % every !== 0) return null;
				return order[(k / every) % order.length];
			});
		}
	} else {
		const routineOn = (date: string) => split.days[weekday(date)] ?? null;
		days = plan(routineOn);
		if (split.catchUp) {
			// Missed in the last week (since the split began) and not trained since: moved onto
			// the next rest days, in the order they were missed.
			const missed: number[] = [];
			// Caught up today, on a rest day: today shows it as done.
			let caughtUpToday: number | null = null;
			for (let i = 7; i >= 1; i--) {
				const date = addDays(today, -i);
				const id = routineOn(date);
				if (date < split.start || id === null) continue;
				if (trainedBetween(trained, id, date, today)) {
					if (wasTrained(trained, id, today) && routineOn(today) === null) caughtUpToday = id;
					continue;
				}
				const at = missed.indexOf(id);
				if (at !== -1) missed.splice(at, 1);
				missed.push(id);
			}
			days = days.map((day) => {
				if (day.date === today && day.routineId === null && caughtUpToday !== null) {
					return { ...day, routineId: caughtUpToday, done: true, moved: true };
				}
				if (day.routineId !== null || missed.length === 0) return day;
				const routineId = missed.shift()!;
				return {
					...day,
					routineId,
					moved: true,
					done: wasTrained(trained, routineId, day.date),
				};
			});
		}
	}

	const first = days.find((d) => d.routineId !== null && !d.done);
	return {
		next: first
			? {
					routineId: first.routineId!,
					date: first.date,
					overdue: first.date === today && overdueFrom !== null,
				}
			: null,
		days,
	};
};
