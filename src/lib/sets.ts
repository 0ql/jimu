export type SetKind = "warmup" | "work" | "drop";

/**
 * A set. `weight` is null for plain bodyweight. With `bodyweight` true the weight is relative to
 * the body: +10 added (dips with a belt), −20 assisted (machine pull-ups); "+10x8" and "-20x8".
 * `reps2` is the second side's reps when the sides differ: "20x12/11" (first side first).
 */
export type ParsedSet =
	| {
			kind: SetKind;
			weight: number | null;
			bodyweight: boolean;
			reps: number;
			reps2?: number;
			n: number;
	  }
	| { kind: "invalid"; token: string };

export type ParsedLine = {
	/** "dd.mm." as written, without the year. */
	date: string | null;
	/** Full year when the line spells one out (dd.mm.yy or dd.mm.yyyy), else null. */
	year: number | null;
	rest: string;
	sets: ParsedSet[];
};

// dd.mm. with an optional year: dd.mm.yy, dd.mm.yyyy (a trailing dot is fine). The year must end
// at a dot, space or line end, so "18.10.30x10" stays a date followed by a set.
const DATE_RE = /^\s*(\d{1,2})\.(\d{1,2})\.(?:(\d{4}|\d{2})(?=[.\s]|$)\.?)?/;
const fullYear = (raw: string) => (raw.length === 2 ? 2000 + parseInt(raw) : parseInt(raw));
const SET_RE = /^([adAD])?([+-])?(\d+(?:[.,]\d+)?)?[xX×](\d+)(?:\/(\d+))?$/;

/** "18.10." for the given day, in the same format the log lines use. */
export const dateStamp = (d = new Date()) =>
	`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;

/**
 * Parses one log line such as "18.10. a10x12 30x10 x8 x7 d15x7".
 * A set without weight reuses the previous weight; "a" marks a warm-up, "d" a drop set. A
 * signed weight is added to or taken off bodyweight ("+10x8", "-20x8"); no weight at all is
 * plain bodyweight. Two rep counts are one per side, first side first ("20x12/11").
 */
export const parseLine = (line: string): ParsedLine => {
	const m = line.match(DATE_RE);
	const date = m ? `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.` : null;
	const year = m?.[3] !== undefined ? fullYear(m[3]) : null;
	const rest = (m ? line.slice(m[0].length) : line).trim();

	let lastWeight: number | null = null;
	let lastSigned = false;
	let n = 0;
	const sets = rest
		.split(/\s+/)
		.filter(Boolean)
		.map((token): ParsedSet => {
			const t = token.match(SET_RE);
			if (!t) return { kind: "invalid", token };
			const kind: SetKind = t[1]?.toLowerCase() === "a" ? "warmup" : t[1] ? "drop" : "work";
			// A sign without a number ("+x8") isn't a weight.
			if (t[2] && t[3] === undefined) return { kind: "invalid", token };
			if (t[3] !== undefined) {
				const value = parseFloat(t[3].replace(",", "."));
				lastWeight = t[2] === "-" ? -value : value;
				lastSigned = !!t[2];
			}
			if (kind === "work") n++;
			return {
				kind,
				weight: lastWeight,
				bodyweight: lastWeight === null || lastSigned,
				reps: parseInt(t[4]),
				...(t[5] !== undefined ? { reps2: parseInt(t[5]) } : {}),
				n,
			};
		});

	return { date, year, rest, sets };
};

/** The last two non-empty lines of a log: today's (or the latest) entry and the one before. */
export const parseLog = (log: string) => {
	const lines = log.split("\n").filter((l) => l.trim());
	return {
		current: parseLine(lines.at(-1) ?? ""),
		previous: lines.length > 1 ? parseLine(lines.at(-2)!) : null,
	};
};

/**
 * The weight a set adds to the volume: the weight, or for bodyweight sets only what was added
 * (assisted and plain bodyweight sets count 0, as jimu doesn't know the body's weight).
 */
export const setLoad = (s: { weight: number | null; bodyweight: boolean }) =>
	s.weight === null ? 0 : s.bodyweight ? Math.max(0, s.weight) : s.weight;

/**
 * All reps of a set, both sides counted: "20x12/11" is 23; on an exercise trained per side
 * (one arm or leg at a time) a single count is for each side, so "20x12" is 24.
 */
export const totalReps = (s: { reps: number; reps2?: number }, perSide = false) =>
	s.reps2 !== undefined ? s.reps + s.reps2 : s.reps * (perSide ? 2 : 1);

/** The reps a set proves for progress: with two sides, the weaker one. */
export const weakerReps = (s: { reps: number; reps2?: number }) =>
	s.reps2 !== undefined ? Math.min(s.reps, s.reps2) : s.reps;

type TopSet = { weight: number | null; bodyweight: boolean; reps: number; reps2?: number };

/**
 * Volume counts working and drop sets; warm-ups are left out. Sets on an exercise trained per
 * side, or written with both sides, count both (see totalReps). The top set is the heaviest
 * working set, then the most reps on the weaker side; for bodyweight sets more added weight (or
 * less assistance) is heavier.
 */
export const lineStats = (sets: ParsedSet[], perSide = false) => {
	let volume = 0;
	let top: TopSet | null = null;
	for (const s of sets) {
		if (s.kind === "invalid") continue;
		if (s.kind !== "warmup") volume += setLoad(s) * totalReps(s, perSide);
		if (
			s.kind === "work" &&
			(!top ||
				(s.weight ?? 0) > (top.weight ?? 0) ||
				((s.weight ?? 0) === (top.weight ?? 0) && weakerReps(s) > weakerReps(top)))
		)
			top = {
				weight: s.weight,
				bodyweight: s.bodyweight,
				reps: s.reps,
				...(s.reps2 !== undefined ? { reps2: s.reps2 } : {}),
			};
	}
	return { volume, top };
};

/** "30", "27,5"; bodyweight as "BW", "BW+10" or "BW−20". */
export const formatWeight = (w: number | null, bodyweight = false) => {
	const number = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");
	if (w === null || (bodyweight && w === 0)) return "BW";
	if (bodyweight) return `BW${w > 0 ? "+" : "−"}${number(Math.abs(w))}`;
	return number(w);
};

/** A set as "30×10", "BW×12", "BW+10×8" or, per side, "20×12/11". */
export const formatSet = (s: {
	weight: number | null;
	bodyweight: boolean;
	reps: number;
	reps2?: number;
}) =>
	`${formatWeight(s.weight, s.bodyweight)}×${s.reps}${s.reps2 !== undefined ? `/${s.reps2}` : ""}`;

export const formatKg = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Days since a "dd.mm." date. Without a year the date is assumed to be within the last 12 months.
 */
export const daysSince = (date: string | null, year: number | null = null, now = new Date()) => {
	if (!date) return null;
	const [d, m] = date.split(".").map(Number);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let then = new Date(year ?? now.getFullYear(), m - 1, d);
	if (year === null && then > today) then = new Date(now.getFullYear() - 1, m - 1, d);
	return Math.round((today.getTime() - then.getTime()) / 86400000);
};

/** "today", "4d" */
export const daysAgo = (date: string | null, year: number | null = null) => {
	const days = daysSince(date, year);
	return days === null ? "" : days === 0 ? "today" : `${days}d`;
};

/** Whether a parsed line is today's entry; a written year has to match too. */
export const isTodayLine = (line: Pick<ParsedLine, "date" | "year">, now = new Date()) =>
	line.date === dateStamp(now) && (line.year === null || line.year === now.getFullYear());

/**
 * Gives every dated line of a log a full date. Lines rarely carry a year, so it is worked out
 * backwards from today: the newest line is within the last 12 months, and going up the log the
 * year drops whenever the month jumps forward. A written year (dd.mm.yy or dd.mm.yyyy) always wins.
 */
export const datedLines = (log: string, now = new Date()) => {
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const rows = log
		.split("\n")
		.map((line) => ({ line, m: line.match(DATE_RE) }))
		.filter((r) => r.m);
	const out: { date: Date; line: string }[] = [];
	let year: number | null = null;
	let laterMonth = 13;
	for (let i = rows.length - 1; i >= 0; i--) {
		const { line, m } = rows[i];
		const day = parseInt(m![1]);
		const month = parseInt(m![2]);
		if (m![3] !== undefined) {
			year = fullYear(m![3]);
		} else if (year === null) {
			year =
				new Date(today.getFullYear(), month - 1, day) > today
					? today.getFullYear() - 1
					: today.getFullYear();
		} else if (month > laterMonth) {
			year--;
		}
		laterMonth = month;
		out.push({ date: new Date(year, month - 1, day), line });
	}
	return out.reverse();
};

/**
 * The letters that mark warm-up and drop sets. Logs are always stored with "a" and "d"; someone
 * who prefers other letters types and reads theirs, translated with swapLetters at the edges, so
 * sync, merging, other devices and the connector keep seeing the same data.
 */
export type SetLetters = { warmup: string; drop: string };
export const DEFAULT_LETTERS: SetLetters = { warmup: "a", drop: "d" };

/** A letter that can mark a set: one letter that isn't "x" (which separates weight and reps). */
export const validLetter = (letter: string) => /^[a-wyz]$/i.test(letter);

const PREFIXED_SET = /^([a-z])([+-]?(?:\d+(?:[.,]\d+)?)?[xX×]\d+(?:\/\d+)?)$/i;

/**
 * Rewrites the warm-up and drop prefixes in a log from one pair of letters to the other, e.g.
 * "a10x12 30x10 d15x7" to "w10x12 30x10 s15x7". Everything else, spacing included, is kept.
 */
export const swapLetters = (log: string, from: SetLetters, to: SetLetters) => {
	if (from.warmup === to.warmup && from.drop === to.drop) return log;
	return log
		.split(/(\s+)/)
		.map((token) => {
			const m = token.match(PREFIXED_SET);
			if (!m) return token;
			const letter = m[1].toLowerCase();
			const next = letter === from.warmup ? to.warmup : letter === from.drop ? to.drop : null;
			if (next === null) return token;
			return (m[1] === letter ? next : next.toUpperCase()) + m[2];
		})
		.join("");
};
