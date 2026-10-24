import { writable } from "svelte/store";

const KEY = "jimu.theme";

/** Night is the original near-black look; app.html applies the saved one before first paint. */
export const THEMES = ["night", "dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

/** Browser bar color per theme, matching each page background. */
const BAR_COLORS: Record<Theme, string> = { night: "#0d0d0e", dark: "#1b1b1e", light: "#f3f3ef" };

const read = (): Theme => {
	try {
		const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
		return THEMES.includes(saved as Theme) ? (saved as Theme) : "night";
	} catch {
		return "night";
	}
};

/** The chosen theme, saved per device. */
export const theme = writable<Theme>(read());

theme.subscribe((t) => {
	if (typeof document === "undefined") return;
	if (t === "night") delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = t;
	document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLORS[t]);
	try {
		localStorage.setItem(KEY, t);
	} catch {
		// Private mode or blocked storage: the theme just lasts for this visit.
	}
});
