import { describe, expect, it } from "vitest";
import { parseSessions, sessionStats } from "./sessions";

const NOW = new Date(2026, 9, 25); // Sunday 25.10.2026

describe("parseSessions", () => {
	it("groups every exercise's lines by day, newest first", () => {
		const sessions = parseSessions(
			[
				{ id: 1, title: "Bench", workoutsString: "20.10. 50x8\n23.10. 50x10 x8" },
				{ id: 2, title: "Abs", workoutsString: "23.10. x20\n25.10. " },
			],
			NOW,
		);
		expect(sessions.map((s) => s.key)).toEqual(["2026-10-23", "2026-10-20"]);
		expect(sessions[0].entries.map((e) => e.title)).toEqual(["Abs", "Bench"]);
		expect(sessions[0].volume).toBe(900);
	});
});

describe("sessionStats", () => {
	const at = (...keys: string[]) =>
		keys.map((key) => {
			const [y, m, d] = key.split("-").map(Number);
			return { date: new Date(y, m - 1, d), key, entries: [], volume: 100 };
		});

	it("counts this week from Monday and the last four weeks", () => {
		const stats = sessionStats(at("2026-10-25", "2026-10-19", "2026-10-18", "2026-09-27"), NOW);
		expect(stats.week).toBe(2);
		expect(stats.fourWeeks).toBe(3);
		expect(stats.avgVolume).toBe(100);
	});

	it("counts weeks in a row, this week included once it has a session", () => {
		expect(sessionStats(at("2026-10-25", "2026-10-18", "2026-10-11"), NOW).streak).toBe(3);
		// Nothing yet this week: the streak still runs from last week.
		expect(sessionStats(at("2026-10-18", "2026-10-11"), NOW).streak).toBe(2);
		expect(sessionStats(at("2026-10-25", "2026-10-05"), NOW).streak).toBe(1);
	});
});
