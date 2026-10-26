import { describe, expect, it } from "vitest";
import {
	formatSet,
	formatWeight,
	lineStats,
	parseLine,
	swapLetters,
	DEFAULT_LETTERS,
} from "./sets";

const sets = (line: string) => parseLine(`01.10. ${line}`).sets;

describe("weighted and assisted bodyweight", () => {
	it("reads +10x8 as added weight and -20x8 as assistance, and repeats them with x8", () => {
		const [added, again, assisted, plain] = sets("+10x8 x6 -20x8 30x10");
		expect(added).toMatchObject({ kind: "work", weight: 10, bodyweight: true, reps: 8 });
		expect(again).toMatchObject({ weight: 10, bodyweight: true, reps: 6 });
		expect(assisted).toMatchObject({ weight: -20, bodyweight: true });
		expect(plain).toMatchObject({ weight: 30, bodyweight: false });
	});

	it("keeps plain bodyweight sets as before", () => {
		expect(sets("x20 x15")[0]).toMatchObject({ weight: null, bodyweight: true, reps: 20 });
	});

	it("works with warm-up and drop letters and refuses a sign without a number", () => {
		expect(sets("a+5x10 d-10x6").map((s) => s.kind)).toEqual(["warmup", "drop"]);
		expect(sets("+x8")[0].kind).toBe("invalid");
	});

	it("counts only added weight in the volume, and ranks the top set by it", () => {
		const stats = lineStats(sets("x10 +10x8 +20x5 -20x12"));
		expect(stats.volume).toBe(10 * 8 + 20 * 5);
		expect(stats.top).toEqual({ weight: 20, bodyweight: true, reps: 5 });
	});

	it("writes them as BW, BW+10 and BW−20", () => {
		expect(formatWeight(null)).toBe("BW");
		expect(formatWeight(10, true)).toBe("BW+10");
		expect(formatWeight(-20, true)).toBe("BW−20");
		expect(formatWeight(27.5)).toBe("27,5");
		expect(formatSet({ weight: 12.5, bodyweight: true, reps: 8 })).toBe("BW+12,5×8");
	});

	it("swaps set letters on signed sets too", () => {
		expect(swapLetters("a+5x10 d-10x6", DEFAULT_LETTERS, { warmup: "w", drop: "s" })).toBe(
			"w+5x10 s-10x6",
		);
	});
});

describe("per side", () => {
	it("doubles the volume for exercises trained one side at a time", () => {
		expect(lineStats(sets("12.5x10 x10"), true).volume).toBe(500);
		expect(lineStats(sets("12.5x10 x10")).volume).toBe(250);
	});
});

describe("both sides", () => {
	it("reads 20x12/11 as 12 reps on the first side and 11 on the second", () => {
		const [set, again] = sets("20x12/11 x10/10");
		expect(set).toMatchObject({ weight: 20, reps: 12, reps2: 11 });
		expect(again).toMatchObject({ weight: 20, reps: 10, reps2: 10 });
		expect(sets("20x12")[0]).not.toHaveProperty("reps2");
		expect(sets("20x12/")[0].kind).toBe("invalid");
	});

	it("counts both sides in the volume, per side or not", () => {
		expect(lineStats(sets("20x12/11")).volume).toBe(20 * 23);
		expect(lineStats(sets("20x12/11"), true).volume).toBe(20 * 23);
		expect(lineStats(sets("20x12/11 20x12"), true).volume).toBe(20 * 23 + 20 * 24);
	});

	it("ranks the top set by the weaker side", () => {
		expect(lineStats(sets("20x12/9 20x10/10")).top).toEqual({
			weight: 20,
			bodyweight: false,
			reps: 10,
			reps2: 10,
		});
	});

	it("writes it as 20×12/11 and keeps it through letter swaps", () => {
		expect(formatSet({ weight: 20, bodyweight: false, reps: 12, reps2: 11 })).toBe("20×12/11");
		expect(swapLetters("a10x12/12 d+5x8/7", DEFAULT_LETTERS, { warmup: "w", drop: "s" })).toBe(
			"w10x12/12 s+5x8/7",
		);
	});
});
