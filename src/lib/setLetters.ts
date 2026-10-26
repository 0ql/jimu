import { get, writable } from "svelte/store";
import { DEFAULT_LETTERS, swapLetters, validLetter, type SetLetters } from "./sets";

const KEY = "jimu.setLetters";

const read = (): SetLetters => {
	try {
		const saved = JSON.parse(
			(typeof localStorage === "undefined" ? null : localStorage.getItem(KEY)) ?? "null",
		);
		const warmup = String(saved?.warmup ?? "").toLowerCase();
		const drop = String(saved?.drop ?? "").toLowerCase();
		if (validLetter(warmup) && validLetter(drop) && warmup !== drop) return { warmup, drop };
	} catch {
		// Unreadable or blocked storage: the usual letters.
	}
	return DEFAULT_LETTERS;
};

/** The letters this device uses for warm-up and drop sets (see swapLetters); a and d by default. */
export const setLetters = writable<SetLetters>(read());

setLetters.subscribe((letters) => {
	try {
		if (letters.warmup === DEFAULT_LETTERS.warmup && letters.drop === DEFAULT_LETTERS.drop)
			localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, JSON.stringify(letters));
	} catch {
		// Private mode or blocked storage: the letters just last for this visit.
	}
});

/** A stored log (a/d) as this device writes it. */
export const toTyped = (log: string) => swapLetters(log, DEFAULT_LETTERS, get(setLetters));
/** A log as typed on this device, back to how it is stored (a/d). */
export const toStored = (log: string) => swapLetters(log, get(setLetters), DEFAULT_LETTERS);
