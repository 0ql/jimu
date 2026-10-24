import { writable } from "svelte/store";

const ENABLED_KEY = "jimu.haptics";
const STRENGTH_KEY = "jimu.haptics.strength";

/** Whether this browser can vibrate at all (Android browsers can; iOS Safari can't). */
export const hapticsSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

/**
 * Pulse lengths in ms. Many Android vibration motors produce nothing you can feel below about
 * 20–30 ms, so the default is 30; "light" is for phones with crisp motors.
 */
export const HAPTIC_STRENGTHS = { light: 15, medium: 30, strong: 50 } as const;
export type HapticStrength = keyof typeof HAPTIC_STRENGTHS;

const read = (key: string) => {
	try {
		return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
	} catch {
		return null;
	}
};
const write = (key: string, value: string) => {
	try {
		if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
	} catch {
		// Private mode or blocked storage: the setting just lasts for this visit.
	}
};

/** "Vibrate on key press", on by default and saved per device. */
export const hapticsEnabled = writable(read(ENABLED_KEY) !== "off");
hapticsEnabled.subscribe((on) => write(ENABLED_KEY, on ? "on" : "off"));

const storedStrength = read(STRENGTH_KEY);
export const hapticStrength = writable<HapticStrength>(
	storedStrength && storedStrength in HAPTIC_STRENGTHS
		? (storedStrength as HapticStrength)
		: "medium",
);
hapticStrength.subscribe((s) => write(STRENGTH_KEY, s));

let enabled = true;
let duration: number = HAPTIC_STRENGTHS.medium;
hapticsEnabled.subscribe((on) => (enabled = on));
hapticStrength.subscribe((s) => (duration = HAPTIC_STRENGTHS[s]));

/**
 * One buzz at the chosen strength regardless of the on/off setting, e.g. to preview it.
 * Returns the browser's answer: true = handed to the phone, false = refused (no tap on the page
 * yet, page hidden, or vibration blocked), null = not supported or it threw.
 */
export const previewHaptic = (ms = duration): boolean | null => {
	if (!hapticsSupported) return null;
	try {
		return navigator.vibrate(ms);
	} catch {
		// Some browsers throw instead of ignoring the call; feedback is optional.
		return null;
	}
};

/** A short tap-like buzz. Silently does nothing where vibration isn't supported or is off. */
export const tapHaptic = () => {
	if (enabled) previewHaptic();
};
