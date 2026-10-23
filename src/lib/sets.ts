export type SetKind = "warmup" | "work" | "drop";

export type ParsedSet =
	| { kind: SetKind; weight: number | null; reps: number; n: number }
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
const SET_RE = /^([adAD])?(\d+(?:[.,]\d+)?)?[xX×](\d+)$/;

/** "18.10." for the given day, in the same format the log lines use. */
export const dateStamp = (d = new Date()) =>
	`${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;

/**
 * Parses one log line such as "18.10. a10x12 30x10 x8 x7 d15x7".
 * A set without weight reuses the previous weight; "a" marks a warm-up, "d" a drop set.
 */
export const parseLine = (line: string): ParsedLine => {
	const m = line.match(DATE_RE);
	const date = m ? `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}.` : null;
	const year = m?.[3] !== undefined ? fullYear(m[3]) : null;
	const rest = (m ? line.slice(m[0].length) : line).trim();

	let lastWeight: number | null = null;
	let n = 0;
	const sets = rest
		.split(/\s+/)
		.filter(Boolean)
		.map((token): ParsedSet => {
			const t = token.match(SET_RE);
			if (!t) return { kind: "invalid", token };
			const kind: SetKind = t[1]?.toLowerCase() === "a" ? "warmup" : t[1] ? "drop" : "work";
			if (t[2] !== undefined) lastWeight = parseFloat(t[2].replace(",", "."));
			if (kind === "work") n++;
			return { kind, weight: lastWeight, reps: parseInt(t[3]), n };
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

/** Volume counts working and drop sets; warm-ups are left out. */
export const lineStats = (sets: ParsedSet[]) => {
	let volume = 0;
	let top: { weight: number | null; reps: number } | null = null;
	for (const s of sets) {
		if (s.kind === "invalid") continue;
		if (s.kind !== "warmup" && s.weight !== null) volume += s.weight * s.reps;
		if (
			s.kind === "work" &&
			(!top ||
				(s.weight ?? 0) > (top.weight ?? 0) ||
				((s.weight ?? 0) === (top.weight ?? 0) && s.reps > top.reps))
		)
			top = { weight: s.weight, reps: s.reps };
	}
	return { volume, top };
};

export const formatWeight = (w: number | null) =>
	w === null ? "BW" : String(Math.round(w * 100) / 100).replace(".", ",");

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
