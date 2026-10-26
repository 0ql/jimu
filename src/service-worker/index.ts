import { assets, immutable } from "$app/manifest";
import { version } from "$app/env";
import { self as sw } from "$app/service-worker";

// App files of this build, and the signed-in user's pages with their data. Both are tied to
// the build: a page's HTML points at that build's files.
const CACHE = `cache-${version}`;
const PAGES = `pages-${version}`;

// Built app files plus everything in static/. Kit 3 lists them relative to the app root
// ("_app/immutable/..."), so resolve them to absolute paths to match request URLs.
const toPath = (file: { path: string }) => new URL(file.path, sw.location.href).pathname;
const APP_FILES = immutable.map(toPath);
const STATIC_FILES = assets.map(toPath);
const ASSETS: string[] = [...APP_FILES, ...STATIC_FILES];

// The tabs, fetched ahead of time so each of them opens offline even if it wasn't visited.
const ROUTES = ["/", "/exercises", "/sessions", "/routines", "/analytics", "/settings"];
const dataPath = (route: string) => `${route === "/" ? "" : route}/__data.json`;

/** Pages are stored without their query (?routine=…, ?x-sveltekit-invalidated=…). */
const pageKey = (url: URL) => url.origin + url.pathname;

/** Tells open tabs whether the server just answered, for the offline banner. */
const tell = async (online: boolean) => {
	for (const client of await sw.clients.matchAll()) client.postMessage({ type: "network", online });
};

/** Keeps a page or its data, unless it is an error or a redirect (e.g. to /login). */
const keep = async (url: URL, response: Response) => {
	if (!response.ok || response.redirected || response.type !== "basic") return;
	const cache = await caches.open(PAGES);
	await cache.put(pageKey(url), response);
};

/** Network first so pages are always current; the last copy when the server can't be reached. */
const networkFirst = async (request: Request) => {
	const url = new URL(request.url);
	try {
		const response = await fetch(request);
		await keep(url, response.clone());
		tell(true);
		return response;
	} catch {
		tell(false);
		const cached =
			(await caches.match(pageKey(url), { ignoreVary: true })) ??
			// A page never stored: the exercises page is the next best thing.
			(request.mode === "navigate"
				? await caches.match(new URL("/", url).href, { ignoreVary: true })
				: undefined);
		return cached ?? Response.error();
	}
};

const warm = async () => {
	await Promise.all(
		ROUTES.flatMap((route) => [route, dataPath(route)]).map(async (path) => {
			const url = new URL(path, sw.location.href);
			try {
				const response = await fetch(url, {
					credentials: "same-origin",
					headers: path.endsWith("__data.json") ? {} : { accept: "text/html" },
				});
				await keep(url, response);
			} catch {
				// Offline or the server is down: try again next time the app starts online.
			}
		}),
	);
};

sw.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then(async (cache) => {
				// The app's code has to be complete or offline use would break, so a failure there
				// fails the install (the browser tries again later). Static files (icons, the
				// manifest) are best effort: one that can't be fetched just isn't kept.
				await cache.addAll(APP_FILES);
				await Promise.allSettled(STATIC_FILES.map((path) => cache.add(path)));
			})
			.then(() => sw.skipWaiting()),
	);
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE && key !== PAGES) await caches.delete(key);
			}
			sw.clients.claim();
		}),
	);
});

sw.addEventListener("message", (event) => {
	// "warm": the app started online and signed in. "forget": the user logged out.
	if (event.data?.type === "warm") event.waitUntil(warm());
	if (event.data?.type === "forget") event.waitUntil(caches.delete(PAGES));
});

sw.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	const url = new URL(event.request.url);
	// The OAuth consent page and the connector's endpoints are never stored.
	if (url.origin !== sw.location.origin || url.pathname.startsWith("/oauth/")) return;

	if (ASSETS.includes(url.pathname)) {
		// ignoreVary: servers like `vite preview` send "Vary: Origin", and code loaded on demand
		// carries an Origin header the stored copy lacks, so a plain match would miss offline.
		// These files are fingerprinted and never change, so the header doesn't matter.
		event.respondWith(
			caches.match(event.request, { ignoreVary: true }).then((r) => r ?? fetch(event.request)),
		);
		return;
	}

	// Pages and the data SvelteKit loads for them when switching tabs.
	if (event.request.mode === "navigate" || url.pathname.endsWith("/__data.json")) {
		event.respondWith(networkFirst(event.request));
	}
});
