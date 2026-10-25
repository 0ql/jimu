import { describe, expect, it } from "vitest";
import {
	addDays,
	daysBetween,
	newSplit,
	splitStatus,
	trainedDates,
	weekday,
	type Split,
} from "./splits";

// Sunday 25.10.2026
const TODAY = "2026-10-25";
const NOW = new Date(2026, 9, 25);
const PUSH = 1;
const PULL = 2;
const LEGS = 3;

const rotation = (over: Partial<Split> = {}): Split => ({
	...newSplit("2026-10-01"),
	name: "PPL",
	routineIds: [PUSH, PULL, LEGS],
	...over,
});
const weekdays = (over: Partial<Split> = {}): Split => ({
	...newSplit("2026-10-01"),
	name: "Weekly",
	kind: "weekdays",
	// Monday Push, Wednesday Pull, Friday Legs
	days: [PUSH, null, PULL, null, LEGS, null, null],
	...over,
});
const trained = (entries: Record<number, string[]>) =>
	new Map(Object.entries(entries).map(([id, dates]) => [Number(id), dates]));
const ids = (days: { routineId: number | null }[]) => days.map((d) => d.routineId);

describe("dates", () => {
	it("counts days across a daylight saving switch", () => {
		expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
		expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});

	it("starts the week on Monday", () => {
		expect(weekday("2026-10-26")).toBe(0);
		expect(weekday(TODAY)).toBe(6);
	});
});

describe("trainedDates", () => {
	const exercises = [
		{ id: 10, workoutsString: "20.10. 30x10\n23.10. 30x10 x8\n25.10. " },
		{ id: 11, workoutsString: "23.10. 50x5" },
	];

	it("counts a tagged day only if one of the routine's exercises was logged that day", () => {
		const routines = [
			{ id: PUSH, exerciseIds: [10], trainedOn: ["2026-10-20", "2026-10-21", "2026-10-25"] },
			{ id: PULL, exerciseIds: [11], trainedOn: ["2026-10-23"] },
		];
		const result = trainedDates({ routines, exercises }, NOW);
		// 21.10. has no line, 25.10. has a date but no sets yet.
		expect(result.get(PUSH)).toEqual(["2026-10-20"]);
		expect(result.get(PULL)).toEqual(["2026-10-23"]);
	});

	it("ignores logged days nobody tagged", () => {
		const routines = [{ id: PUSH, exerciseIds: [10, 11] }];
		expect(trainedDates({ routines, exercises }, NOW).get(PUSH)).toEqual([]);
	});
});

describe("rotation, keep the order", () => {
	it("follows the last session: Push on Friday means Pull today", () => {
		const status = splitStatus(rotation(), trained({ [PUSH]: ["2026-10-23"] }), TODAY, 7);
		expect(status.next).toEqual({ routineId: PULL, date: TODAY, overdue: false });
		expect(ids(status.days)).toEqual([PULL, null, LEGS, null, PUSH, null, PULL]);
	});

	it("waits with a missed routine: it is due today until it's done", () => {
		const status = splitStatus(rotation(), trained({ [PUSH]: ["2026-10-19"] }), TODAY, 3);
		expect(status.next).toEqual({ routineId: PULL, date: TODAY, overdue: true });
		expect(ids(status.days)).toEqual([PULL, null, LEGS]);
	});

	it("shows today's session as done and moves on", () => {
		const status = splitStatus(
			rotation(),
			trained({ [PUSH]: ["2026-10-23"], [PULL]: [TODAY] }),
			TODAY,
			5,
		);
		expect(status.days[0]).toEqual({ date: TODAY, routineId: PULL, done: true });
		expect(status.next).toEqual({ routineId: LEGS, date: "2026-10-27", overdue: false });
		expect(ids(status.days)).toEqual([PULL, null, LEGS, null, PUSH]);
	});

	it("starts with the first routine when nothing was trained yet", () => {
		const fresh = rotation({ start: TODAY });
		expect(splitStatus(fresh, trained({}), TODAY).next).toEqual({
			routineId: PUSH,
			date: TODAY,
			overdue: false,
		});
		const later = rotation({ start: "2026-10-27" });
		expect(splitStatus(later, trained({}), TODAY).next?.date).toBe("2026-10-27");
	});

	it("trains every third day when asked", () => {
		const status = splitStatus(
			rotation({ everyDays: 3 }),
			trained({ [PUSH]: ["2026-10-22"] }),
			TODAY,
			7,
		);
		expect(ids(status.days)).toEqual([PULL, null, null, LEGS, null, null, PUSH]);
	});
});

describe("rotation, keep the dates", () => {
	it("counts from the start and skips what was missed", () => {
		// Start 22.10.: Push 22., Pull 24., Legs 26., Push 28.
		const split = rotation({ keepOrder: false, start: "2026-10-22" });
		const status = splitStatus(split, trained({ [PUSH]: ["2026-10-22"] }), TODAY, 4);
		expect(ids(status.days)).toEqual([null, LEGS, null, PUSH]);
		expect(status.next).toEqual({ routineId: LEGS, date: "2026-10-26", overdue: false });
	});
});

describe("weekdays", () => {
	it("repeats the same days every week", () => {
		const status = splitStatus(weekdays(), trained({}), TODAY, 7);
		// Sunday, Monday, Tuesday …
		expect(ids(status.days)).toEqual([null, PUSH, null, PULL, null, LEGS, null]);
		expect(status.next).toEqual({ routineId: PUSH, date: "2026-10-26", overdue: false });
	});

	it("skips a missed day by default", () => {
		// Legs on Friday 23.10. was missed; nothing changes.
		const status = splitStatus(
			weekdays(),
			trained({ [PUSH]: ["2026-10-19"], [PULL]: ["2026-10-21"] }),
			TODAY,
			3,
		);
		expect(ids(status.days)).toEqual([null, PUSH, null]);
	});

	it("catches up a missed day on the next rest day", () => {
		const split = weekdays({ catchUp: true });
		const status = splitStatus(
			split,
			trained({ [PUSH]: ["2026-10-19"], [PULL]: ["2026-10-21"] }),
			TODAY,
			3,
		);
		expect(status.days[0]).toEqual({ date: TODAY, routineId: LEGS, done: false, moved: true });
		expect(ids(status.days)).toEqual([LEGS, PUSH, null]);
		expect(status.next).toEqual({ routineId: LEGS, date: TODAY, overdue: false });
	});

	it("doesn't catch up what was trained later anyway, or what came before the split", () => {
		const done = splitStatus(
			weekdays({ catchUp: true }),
			trained({ [PUSH]: ["2026-10-19"], [PULL]: ["2026-10-21"], [LEGS]: [TODAY] }),
			TODAY,
			2,
		);
		expect(done.days[0]).toMatchObject({ routineId: LEGS, done: true, moved: true });
		const fresh = splitStatus(weekdays({ catchUp: true, start: TODAY }), trained({}), TODAY, 2);
		expect(ids(fresh.days)).toEqual([null, PUSH]);
	});
});

describe("rotation on gym days", () => {
	// Tuesday, Wednesday, Thursday, Saturday, Sunday
	const gymWeek = (over: Partial<Split> = {}) =>
		rotation({ pace: "gym-days", gymDays: [1, 2, 3, 5, 6], ...over });

	it("takes turns on the gym days only", () => {
		// Push on Saturday 24.10.: Pull today (Sunday), Legs Tuesday, Push Wednesday …
		const status = splitStatus(gymWeek(), trained({ [PUSH]: ["2026-10-24"] }), TODAY, 7);
		expect(ids(status.days)).toEqual([PULL, null, LEGS, PUSH, PULL, null, LEGS]);
		expect(status.next).toEqual({ routineId: PULL, date: TODAY, overdue: false });
	});

	it("keeps the order when a gym day is missed", () => {
		// Push on Wednesday 21.10.; Pull was due Thursday and is still next, today.
		const status = splitStatus(gymWeek(), trained({ [PUSH]: ["2026-10-21"] }), TODAY, 3);
		expect(ids(status.days)).toEqual([PULL, null, LEGS]);
		expect(status.next).toEqual({ routineId: PULL, date: TODAY, overdue: true });
	});

	it("waits for the next gym day when today isn't one", () => {
		const split = gymWeek({ gymDays: [1, 2, 3, 5] });
		const status = splitStatus(split, trained({ [PUSH]: ["2026-10-24"] }), TODAY, 3);
		expect(ids(status.days)).toEqual([null, null, PULL]);
		expect(status.next?.date).toBe("2026-10-27");
	});

	it("keeps the dates: every gym day since the start has its routine", () => {
		// From Tuesday 20.10.: Push 20., Pull 21., Legs 22., Push 24., Pull 25., Legs 27.
		const split = gymWeek({ keepOrder: false, start: "2026-10-20" });
		const status = splitStatus(split, trained({}), TODAY, 4);
		expect(ids(status.days)).toEqual([PULL, null, LEGS, PUSH]);
	});

	it("has nothing planned without gym days", () => {
		expect(splitStatus(gymWeek({ gymDays: [] }), trained({}), TODAY).next).toBeNull();
	});
});
