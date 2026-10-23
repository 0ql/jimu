import { tick } from "svelte";
import { saveExercise, type Exercise } from "./idb";
import { dateStamp, isTodayLine, lineStats, parseLog } from "$lib/sets";
import type { KeypadKey } from "$lib/ui/SetKeypad.svelte";

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
	inputmode: "text" | "none" | "decimal" = $derived(
		this.textKeyboard ? "text" : this.touch ? "none" : "decimal",
	);

	#exercise: () => Exercise;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(exercise: () => Exercise) {
		this.#exercise = exercise;
		const e = exercise();
		this.title = e.title;
		this.workoutsString = e.workoutsString;
		this.note = e.note ?? "";
	}

	save = () => {
		clearTimeout(this.#saveTimer);
		return saveExercise({
			...this.#exercise(),
			title: this.title,
			workoutsString: this.workoutsString,
			note: this.note.trim() || undefined,
		});
	};

	saveSoon = () => {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(this.save, 800);
	};

	#caret = () => {
		const focused = !!this.textarea && document.activeElement === this.textarea;
		const end = this.workoutsString.length;
		return {
			start: focused ? this.textarea!.selectionStart : end,
			end: focused ? this.textarea!.selectionEnd : end,
		};
	};

	#placeCaret = async (pos: number) => {
		await tick();
		this.textarea?.focus();
		this.textarea?.setSelectionRange(pos, pos);
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
