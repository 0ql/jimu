import { tick } from "svelte";
import { get } from "svelte/store";
import { exercises, recordTraining, registerEditor, saveExercise, type Exercise } from "./idb";
import { mergeExercises } from "#lib/merge.js";
import { datedLines, dateStamp, isTodayLine, lineStats, parseLine, parseLog } from "#lib/sets.js";
import type { KeypadKey } from "#lib/ui/SetKeypad.svelte";

type Fields = Pick<Exercise, "title" | "workoutsString" | "note">;
const fieldsOf = (e: Fields): Fields => ({
	title: e.title,
	workoutsString: e.workoutsString,
	note: e.note?.trim() || undefined,
});
const sameFields = (a: Fields, b: Fields) =>
	a.title === b.title && a.workoutsString === b.workoutsString && (a.note ?? "") === (b.note ?? "");

/**
 * Editing state for one exercise's log, shared by the phone row and the desktop pane:
 * the text, its parsed current line, saving, and the set keypad's insert logic.
 */
export class LogEditor {
	title = $state("");
	workoutsString = $state("");
	note = $state("");
	textarea: HTMLTextAreaElement | undefined = $state();

	/** Touch devices get the in-app set keypad instead of the system keyboard. */
	readonly touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
	padOpen = $state(false);
	textKeyboard = $state(false);
	readonly stamp = dateStamp();

	log = $derived(parseLog(this.workoutsString));
	isToday = $derived(isTodayLine(this.log.current));
	stats = $derived(lineStats(this.log.current.sets));
	delta = $derived(
		this.log.previous
			? Math.round(this.stats.volume - lineStats(this.log.previous.sets).volume)
			: null,
	);
	sessionCount = $derived(this.workoutsString.split("\n").filter((l) => l.trim()).length);
	/** Each non-empty log line, with its full date (year worked out like on the sessions page). */
	sessions = $derived.by(() => {
		const dated = datedLines(this.workoutsString);
		let next = 0;
		return this.workoutsString
			.split("\n")
			.filter((l) => l.trim())
			.map((line) => {
				const parsed = parseLine(line);
				return { ...parsed, fullDate: parsed.date ? (dated[next++]?.date ?? null) : null };
			});
	});
	/** Earlier sessions, newest first. */
	history = $derived(this.sessions.slice(0, -1).reverse());
	/** Volume of the last eight sessions, oldest first, for the bar charts. */
	recent = $derived(
		this.sessions.slice(-8).map((p) => ({
			date: p.date?.slice(0, 5) ?? "—",
			volume: lineStats(p.sets).volume,
		})),
	);
	inputmode: "text" | "none" | "decimal" = $derived(
		this.textKeyboard ? "text" : this.touch ? "none" : "decimal",
	);

	#exercise: () => Exercise;
	/** What this editor last loaded or saved; a save only writes what was changed since. */
	#saved: Fields;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;
	/** Where the caret is going while an insert waits for the DOM to update. */
	#pendingCaret: number | null = null;

	constructor(exercise: () => Exercise) {
		this.#exercise = exercise;
		const e = exercise();
		this.title = e.title;
		this.workoutsString = e.workoutsString;
		this.note = e.note ?? "";
		this.#saved = fieldsOf(e);
		// A sync writes out unsaved typing first; the editor leaves the list with its component.
		$effect(() => registerEditor(this.flush));
	}

	/**
	 * Writes the edit. Nothing is written unless something was typed since the last save, so an
	 * editor that is just closing or being replaced never puts back an older copy. If the stored
	 * exercise changed meanwhile (a sync merged in another device's lines), the edit is merged
	 * into it instead of overwriting it.
	 */
	save = async () => {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = undefined;
		const mine = fieldsOf({
			title: this.title,
			workoutsString: this.workoutsString,
			note: this.note,
		});
		if (sameFields(mine, this.#saved)) return;

		const exercise = this.#exercise();
		const stored = get(exercises).find((e) => e.id === exercise.id) ?? exercise;
		let next = mine;
		if (!sameFields(fieldsOf(stored), this.#saved)) {
			const id = exercise.id;
			const [merged] = mergeExercises([{ id, ...this.#saved }], [{ id, ...mine }], [stored]).merged;
			next = merged ? fieldsOf(merged) : mine;
			this.title = next.title;
			this.workoutsString = next.workoutsString;
			this.note = next.note ?? "";
		}
		this.#saved = next;
		await saveExercise({ ...exercise, ...next });
		await recordTraining(exercise.id, next.workoutsString);
	};

	/** Saves now if a save is still waiting, e.g. before the editor goes away. */
	flush = () => {
		if (this.#saveTimer === undefined) return;
		return this.save();
	};

	saveSoon = () => {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(this.save, 800);
	};

	#caret = () => {
		// A key pressed before the previous one's caret was placed continues from that position,
		// so fast presses never insert at a stale caret.
		if (this.#pendingCaret !== null) return { start: this.#pendingCaret, end: this.#pendingCaret };
		const focused = !!this.textarea && document.activeElement === this.textarea;
		const end = this.workoutsString.length;
		return {
			start: focused ? this.textarea!.selectionStart : end,
			end: focused ? this.textarea!.selectionEnd : end,
		};
	};

	#placeCaret = async (pos: number) => {
		this.#pendingCaret = pos;
		await tick();
		// A newer press already moved on; it places the caret itself.
		if (this.#pendingCaret !== pos) return;
		this.textarea?.focus();
		this.textarea?.setSelectionRange(pos, pos);
		this.#pendingCaret = null;
	};

	/** Inserts text at the caret (or the end); `separate` adds a space before it if needed. */
	insert = async (text: string, separate = false) => {
		const { start, end } = this.#caret();
		const before = this.workoutsString.slice(0, start);
		const insertText = separate && before && !/\s$/.test(before) ? ` ${text}` : text;
		this.workoutsString = before + insertText + this.workoutsString.slice(end);
		this.saveSoon();
		await this.#placeCaret(start + insertText.length);
	};

	backspace = async () => {
		let { start, end } = this.#caret();
		if (start === end) start = Math.max(0, start - 1);
		this.workoutsString = this.workoutsString.slice(0, start) + this.workoutsString.slice(end);
		this.saveSoon();
		await this.#placeCaret(start);
	};

	/** Starts a line for today unless the last line already is today's, then puts the caret at the end. */
	addToday = async () => {
		if (!this.isToday) {
			const trimmed = this.workoutsString.replace(/\s+$/, "");
			this.workoutsString = `${trimmed}${trimmed ? "\n" : ""}${this.stamp} `;
			this.saveSoon();
		}
		await this.#placeCaret(this.workoutsString.length);
		if (this.textarea) this.textarea.scrollTop = this.textarea.scrollHeight;
	};

	onKey = (key: KeypadKey) => {
		if (key === "back") this.backspace();
		else if (key === "today") this.addToday();
		else if (key === "a" || key === "d") this.insert(key, true);
		else if (key === "space") this.insert(" ");
		else if (key === "enter") this.insert("\n");
		else this.insert(key);
	};

	/** Opens the keypad when the log gets focus on a touch device; true if it just opened. */
	openPad = () => {
		if (!this.touch || this.textKeyboard || this.padOpen) return false;
		this.padOpen = true;
		return true;
	};

	closePad = () => {
		this.padOpen = false;
		this.textarea?.blur();
	};

	/** Switching hides one keyboard and focuses again so the other one appears. */
	useSystemKeyboard = async (on: boolean) => {
		this.textKeyboard = on;
		this.padOpen = !on;
		this.textarea?.blur();
		await tick();
		this.textarea?.focus();
	};

	resetKeyboard = () => {
		this.padOpen = false;
		this.textKeyboard = false;
	};
}

/** A history entry's date as dd.mm.yy, or as written when the year is unknown. */
export const historyDate = (entry: { date: string | null; fullDate: Date | null }) =>
	entry.fullDate
		? entry.fullDate.toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
			})
		: (entry.date ?? "—");
