import { assets, immutable } from "$app/manifest";
import { version } from "$app/env";
import { self as sw } from "$app/service-worker";

const CACHE = `cache-${version}`;
// Built app files plus everything in static/. Kit 3 lists them relative to the app root
// ("_app/immutable/..."), so resolve them to absolute paths to match request URLs.
const ASSETS: string[] = [...immutable, ...assets].map(
	(file) => new URL(file.path, sw.location.href).pathname,
);

sw.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting()),
	);
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) await caches.delete(key);
			}
			sw.clients.claim();
		}),
	);
});

sw.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	const url = new URL(event.request.url);
	const isAsset = ASSETS.includes(url.pathname);

	if (isAsset) {
		event.respondWith(caches.match(event.request).then((r) => r ?? fetch(event.request)));
		return;
	}

	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const clone = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, clone));
					return response;
				})
				.catch(() => caches.match(event.request).then((r) => r ?? caches.match("/")!)),
		);
	}
});
