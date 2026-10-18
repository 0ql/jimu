export type SetKind = "warmup" | "work" | "drop";

export type ParsedSet =
	| { kind: SetKind; weight: number | null; reps: number; n: number }
	| { kind: "invalid"; token: string };

export type ParsedLine = {
	date: string | null;
	rest: string;
	sets: ParsedSet[];
};

const DATE_RE = /^\s*(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})\.)?/;
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

	return { date, rest, sets };
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

/** "today", "4d" — dates without a year are assumed to be within the last 12 months. */
export const daysAgo = (date: string | null, now = new Date()) => {
	if (!date) return "";
	const [d, m] = date.split(".").map(Number);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let then = new Date(now.getFullYear(), m - 1, d);
	if (then > today) then = new Date(now.getFullYear() - 1, m - 1, d);
	const days = Math.round((today.getTime() - then.getTime()) / 86400000);
	return days === 0 ? "today" : `${days}d`;
};
