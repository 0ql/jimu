/**
 * Training sessions: every day with logged sets, across all exercises. Shared by the home page
 * (stats, calendar, recent sessions) and the sessions list.
 */
import { datedLines, lineStats, parseLine, type ParsedSet } from "./sets";
import { isoDate } from "./splits";

export type SessionEntry = {
	id: number;
	title: string;
	tokens: { text: string; kind: ParsedSet["kind"] }[];
	volume: number;
};
/** `key` is the day as "YYYY-MM-DD". */
export type Session = { date: Date; key: string; entries: SessionEntry[]; volume: number };

/** Newest first; each exercise once per day, alphabetically. */
export const parseSessions = (
	all: { id?: number; title: string; workoutsString: string; perSide?: boolean }[],
	now = new Date(),
): Session[] => {
	const map = new Map<string, Session>();
	for (const exercise of all) {
		for (const { date, line: row } of datedLines(exercise.workoutsString, now)) {
			const { rest, sets } = parseLine(row);
			if (!sets.length) continue;
			const key = isoDate(date);
			if (!map.has(key)) map.set(key, { date, key, entries: [], volume: 0 });
			const session = map.get(key)!;
			const volume = lineStats(sets, exercise.perSide).volume;
			// Show the sets as typed (x8 stays x8), colored by kind.
			const tokens = rest
				.split(/\s+/)
				.filter(Boolean)
				.map((text, i) => ({ text, kind: sets[i].kind }));
			// The same day written twice in one log becomes one row (the list is keyed by exercise).
			const existing = session.entries.find((e) => e.id === exercise.id);
			if (existing) {
				existing.tokens.push(...tokens);
				existing.volume += volume;
			} else {
				session.entries.push({ id: exercise.id!, title: exercise.title, tokens, volume });
			}
			session.volume += volume;
		}
	}
	for (const s of map.values()) s.entries.sort((a, b) => a.title.localeCompare(b.title));
	return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
};

/**
 * Sessions this week (from Monday) and in the last four weeks, their average volume, and the
 * streak: weeks in a row with at least one session, counting this week once it has one.
 */
export const sessionStats = (sessions: Session[], now = new Date()) => {
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const daysBack = (n: number) =>
		new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
	const weekStart = daysBack((today.getDay() + 6) % 7);
	const recent = sessions.filter((s) => s.date >= daysBack(27));

	// Days are counted rounded, so a daylight saving switch doesn't shift a week.
	const weeksAgo = (d: Date) =>
		Math.ceil(Math.round((weekStart.getTime() - d.getTime()) / 86400000) / 7);
	const trainedWeeks = new Set(sessions.map((s) => (s.date >= weekStart ? 0 : weeksAgo(s.date))));
	let streak = 0;
	for (let w = trainedWeeks.has(0) ? 0 : 1; trainedWeeks.has(w); w++) streak++;

	return {
		week: sessions.filter((s) => s.date >= weekStart).length,
		fourWeeks: recent.length,
		avgVolume: recent.length ? recent.reduce((sum, s) => sum + s.volume, 0) / recent.length : 0,
		streak,
	};
};
