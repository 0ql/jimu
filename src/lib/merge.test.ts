import { describe, expect, it } from "vitest";
import { mergeExercises, mergeIds, mergeLog, mergeRoutines, newId } from "./merge";

const NOW = new Date(2026, 9, 24); // 24.10.2026
const log = (...lines: string[]) => lines.join("\n");

describe("mergeLog", () => {
	const base = log("07.10. a10x12 27.5x10", "14.10. 30x10 x8");

	it("keeps a log nobody changed", () => {
		expect(mergeLog(base, base, base, NOW)).toEqual({ log: base, conflict: false });
	});

	it("takes the side that changed when only one did", () => {
		const changed = log(base, "24.10. 30x10");
		expect(mergeLog(base, changed, base, NOW).log).toBe(changed);
		expect(mergeLog(base, base, changed, NOW).log).toBe(changed);
	});

	it("combines days logged on two devices, in date order", () => {
		const phone = log(base, "24.10. phone 30x10");
		const laptop = log(base, "23.10. laptop 30x9");
		expect(mergeLog(base, phone, laptop, NOW)).toEqual({
			log: log(base, "23.10. laptop 30x9", "24.10. phone 30x10"),
			conflict: false,
		});
		// Same result whichever side is "local".
		expect(mergeLog(base, laptop, phone, NOW).log).toBe(
			log(base, "23.10. laptop 30x9", "24.10. phone 30x10"),
		);
	});

	it("keeps an edit from one side and an addition from the other", () => {
		const edited = log("07.10. a10x12 27.5x10", "14.10. 30x10 x9");
		const added = log(base, "23.10. 30x10");
		expect(mergeLog(base, edited, added, NOW).log).toBe(
			log("07.10. a10x12 27.5x10", "14.10. 30x10 x9", "23.10. 30x10"),
		);
	});

	it("applies a deletion from one side", () => {
		const deleted = log("14.10. 30x10 x8");
		const added = log(base, "23.10. 30x10");
		expect(mergeLog(base, added, deleted, NOW).log).toBe(log("14.10. 30x10 x8", "23.10. 30x10"));
	});

	it("keeps both versions when both sides edited the same day, and flags it", () => {
		const phone = log("07.10. a10x12 27.5x10", "14.10. 30x10 x7");
		const laptop = log("07.10. a10x12 27.5x10", "14.10. 32.5x10");
		expect(mergeLog(base, phone, laptop, NOW)).toEqual({
			log: log("07.10. a10x12 27.5x10", "14.10. 30x10 x7", "14.10. 32.5x10"),
			conflict: true,
		});
	});

	it("flags two different lines added for the same day", () => {
		const phone = log(base, "24.10. 30x10");
		const laptop = log(base, "24.10. 20x12");
		const result = mergeLog(base, phone, laptop, NOW);
		expect(result.log).toBe(log(base, "24.10. 30x10", "24.10. 20x12"));
		expect(result.conflict).toBe(true);
	});

	it("adds a line both sides added identically only once", () => {
		const both = log(base, "24.10. 30x10");
		const phone = log(both, "25.10. x");
		expect(mergeLog(base, phone, both, NOW).log).toBe(phone);
		expect(mergeLog(base, log(base, "24.10. 30x10", "20.10. y"), both, NOW).log).toBe(
			log(base, "20.10. y", "24.10. 30x10"),
		);
	});

	it("loses nothing without a base", () => {
		const phone = log("07.10. a", "24.10. phone");
		const laptop = log("07.10. a", "23.10. laptop");
		expect(mergeLog("", phone, laptop, NOW).log).toBe(
			log("07.10. a", "23.10. laptop", "24.10. phone"),
		);
	});

	it("orders across a new year", () => {
		const jan = new Date(2027, 0, 5);
		const start = log("28.12. a");
		expect(mergeLog(start, log(start, "03.01. phone"), log(start, "30.12. laptop"), jan).log).toBe(
			log("28.12. a", "30.12. laptop", "03.01. phone"),
		);
	});

	it("ignores trailing spaces when comparing lines", () => {
		const typing = log(base, "24.10. ");
		const laptop = log(base, "23.10. x");
		expect(mergeLog(log(base, "24.10."), typing, log(base, "24.10.", "23.10. x"), NOW).log).toBe(
			log(base, "23.10. x", "24.10. "),
		);
		expect(mergeLog(base, typing, laptop, NOW).log).toBe(log(base, "23.10. x", "24.10. "));
	});

	it("keeps an undated line below the day it was written under", () => {
		const phone = log(base, "felt strong");
		const laptop = log(base, "23.10. x");
		expect(mergeLog(base, phone, laptop, NOW).log).toBe(log(base, "felt strong", "23.10. x"));
	});
});

describe("mergeExercises", () => {
	const bench = { id: 1, title: "Bench", workoutsString: "07.10. 50x10" };
	const squat = { id: 2, title: "Squat", workoutsString: "07.10. 80x5", note: "rack 4" };
	const base = [bench, squat];

	it("keeps changes to different exercises from both sides", () => {
		const local = [{ ...bench, workoutsString: "07.10. 50x10\n24.10. 52.5x8" }, squat];
		const server = [bench, { ...squat, workoutsString: "07.10. 80x5\n23.10. 85x5" }];
		expect(mergeExercises(base, local, server, NOW)).toEqual({
			merged: [local[0], server[1]],
			conflicts: [],
		});
	});

	it("keeps exercises created on either side", () => {
		const phoneNew = { id: 1792800000000123, title: "Curl", workoutsString: "" };
		const laptopNew = { id: 1792800000555456, title: "Row", workoutsString: "" };
		const { merged } = mergeExercises(base, [...base, phoneNew], [...base, laptopNew], NOW);
		expect(merged).toEqual([bench, squat, phoneNew, laptopNew]);
	});

	it("deletes an exercise removed on one side and untouched on the other", () => {
		expect(mergeExercises(base, [bench], base, NOW).merged).toEqual([bench]);
		expect(mergeExercises(base, base, [squat], NOW).merged).toEqual([squat]);
	});

	it("keeps an exercise deleted on one side but logged on the other", () => {
		const logged = { ...squat, workoutsString: "07.10. 80x5\n24.10. 90x3" };
		expect(mergeExercises(base, [bench], [bench, logged], NOW).merged).toEqual([bench, logged]);
	});

	it("takes a rename from the side that made it, and this device's when both did", () => {
		const renamed = { ...bench, title: "Bench press" };
		expect(mergeExercises(base, base, [renamed, squat], NOW).merged[0].title).toBe("Bench press");
		const both = mergeExercises(
			base,
			[{ ...bench, title: "Phone name", workoutsString: "x" }, squat],
			[{ ...bench, title: "Laptop name" }, squat],
			NOW,
		);
		expect(both.merged[0].title).toBe("Phone name");
	});

	it("applies a removed setup note without leaving an empty key", () => {
		const noNote = { id: 2, title: "Squat", workoutsString: "07.10. 80x5" };
		const result = mergeExercises(base, [bench, noNote], [{ ...bench, title: "B" }, squat], NOW);
		expect(result.merged[1]).toEqual(noNote);
		expect("note" in result.merged[1]).toBe(false);
	});

	it("names the exercises where both sides logged the same day", () => {
		const { conflicts } = mergeExercises(
			base,
			[{ ...bench, workoutsString: "07.10. 50x10\n24.10. 50x8" }, squat],
			[{ ...bench, workoutsString: "07.10. 50x10\n24.10. 55x6" }, squat],
			NOW,
		);
		expect(conflicts).toEqual(["Bench"]);
	});

	it("loses nothing without a base", () => {
		const local = [{ ...bench, workoutsString: "07.10. 50x10\n24.10. a" }];
		const server = [{ ...bench, workoutsString: "07.10. 50x10\n23.10. b" }, squat];
		expect(mergeExercises([], local, server, NOW).merged).toEqual([
			{ ...bench, workoutsString: "07.10. 50x10\n23.10. b\n24.10. a" },
			squat,
		]);
	});
});

describe("mergeRoutines", () => {
	const push = { id: 1, name: "Push", exerciseIds: [1, 2, 3] };

	it("keeps a reorder from one side and an addition from the other", () => {
		const reordered = { ...push, exerciseIds: [3, 1, 2] };
		const added = { ...push, exerciseIds: [1, 2, 3, 4] };
		expect(mergeRoutines([push], [reordered], [added])).toEqual([
			{ ...push, exerciseIds: [3, 1, 2, 4] },
		]);
	});

	it("applies a removal from either side", () => {
		expect(mergeIds([1, 2, 3], [1, 2, 3, 5], [1, 3])).toEqual([1, 3, 5]);
	});

	it("deletes and keeps routines like exercises", () => {
		const legs = { id: 2, name: "Legs", exerciseIds: [7] };
		expect(mergeRoutines([push, legs], [push], [push, legs])).toEqual([push]);
		expect(mergeRoutines([push, legs], [push], [push, { ...legs, name: "Leg day" }])).toEqual([
			push,
			{ ...legs, name: "Leg day" },
		]);
	});
});

describe("newId", () => {
	it("is a whole number far above the old counting ids, and differs between devices", () => {
		const a = newId(1792800000000);
		expect(Number.isSafeInteger(a)).toBe(true);
		expect(a).toBeGreaterThan(1e15);
		const ids = new Set(Array.from({ length: 200 }, () => newId(1792800000000)));
		expect(ids.size).toBeGreaterThan(150);
	});
});
