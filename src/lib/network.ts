import { writable } from "svelte/store";

/**
 * Whether the server can be reached. It starts from the browser's own flag and follows its
 * online/offline events, but a failed request also counts: Wi-Fi without internet, or the
 * server being down, looks online to the browser.
 */
export const online = writable(typeof navigator === "undefined" ? true : navigator.onLine);

/** Asks the service worker to store every tab's page, so the app opens offline. */
export const warmOfflineCache = () =>
	navigator.serviceWorker?.ready.then((registration) =>
		registration.active?.postMessage({ type: "warm" }),
	);

/** Drops the stored pages, which belong to the account that is logging out. */
export const forgetOfflineCache = () =>
	navigator.serviceWorker?.controller?.postMessage({ type: "forget" });

/** True when a fetch failed for lack of a connection rather than with an HTTP error. */
export const isNetworkError = (error: unknown) => error instanceof TypeError;
