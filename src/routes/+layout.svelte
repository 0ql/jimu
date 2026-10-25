<script lang="ts">
	import favicon from "#lib/assets/favicon.svg";
	import "virtual:uno.css";
	import "./main.css";
	import Toasts from "#lib/ui/Toasts.svelte";
	import { page } from "$app/state";
	import TabBar from "./TabBar.svelte";
	import OfflineBanner from "./OfflineBanner.svelte";
	import { onMount } from "svelte";
	import { online, warmOfflineCache } from "#lib/network.js";
	import { checkForUpdates } from "./idb";
	import { toast } from "#lib/toast.svelte.js";

	let { children } = $props();

	// One title for the whole app, following the route. Pages don't set their own: Svelte sets
	// document.title when such a page mounts but never puts the old one back, so "Log in" stuck
	// around after logging in.
	const TITLES: Record<string, string> = {
		"/": "Exercises",
		"/sessions": "Sessions",
		"/routines": "Routines",
		"/analytics": "Analytics",
		"/settings": "Settings",
		"/admin": "Admin",
		"/login": "Log in",
		"/signup": "Create account",
	};
	const title = $derived(
		TITLES[page.url.pathname] ? `${TITLES[page.url.pathname]} · jimu` : "jimu",
	);

	// Offline handling. The browser's events say when the network goes; a light request to the
	// server confirms it is back (and catches "online" but unreachable). Coming back syncs both
	// ways and refreshes the stored pages.
	const PROBE_MS = 15_000;
	const probe = async () => {
		try {
			const res = await fetch("/manifest.json", { method: "HEAD", cache: "no-store" });
			online.set(res.ok);
		} catch {
			online.set(false);
		}
	};

	// Changes made elsewhere (another device, a connected assistant) come in when the app is shown
	// again (switching back to it, unlocking the phone) and every few minutes while it stays open.
	// Each check only asks for the server's versions unless something changed.
	const CHECK_EVERY_MS = 2 * 60_000;
	const MIN_GAP_MS = 15_000;
	let lastCheck = 0;
	const check = (force = false) => {
		if (!$online || document.visibilityState !== "visible") return;
		if (!force && Date.now() - lastCheck < MIN_GAP_MS) return;
		lastCheck = Date.now();
		checkForUpdates();
	};

	// Signed in and online: (re)fill the stored pages. Runs once the startup check is done, right
	// after logging in (the layout stays mounted through login, so onMount alone missed that) and
	// whenever the connection comes back.
	let startupChecked = $state(false);
	$effect(() => {
		if (startupChecked && $online && page.data.userUuid) warmOfflineCache();
	});

	onMount(() => {
		const goOffline = () => online.set(false);
		const onWorkerMessage = (e: MessageEvent) => {
			if (e.data?.type === "network") online.set(e.data.online);
		};
		addEventListener("offline", goOffline);
		addEventListener("online", probe);
		navigator.serviceWorker?.addEventListener("message", onWorkerMessage);

		// A page served from the worker's copy may still think it is online, and the worker's
		// message can arrive before this listener: ask the server once at startup.
		let wasOnline = $online;
		probe().then(() => {
			startupChecked = true;
			check(true);
		});
		const onShown = () => check();
		document.addEventListener("visibilitychange", onShown);
		addEventListener("focus", onShown);
		const every = setInterval(() => check(true), CHECK_EVERY_MS);
		let timer: ReturnType<typeof setInterval> | undefined;
		const unsubscribe = online.subscribe((isOnline) => {
			clearInterval(timer);
			if (!isOnline) timer = setInterval(probe, PROBE_MS);
			else if (!wasOnline) {
				toast.success("Back online. Syncing your changes…");
				check(true);
			}
			wasOnline = isOnline;
		});
		return () => {
			removeEventListener("offline", goOffline);
			removeEventListener("online", probe);
			navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
			document.removeEventListener("visibilitychange", onShown);
			removeEventListener("focus", onShown);
			clearInterval(every);
			clearInterval(timer);
			unsubscribe();
		};
	});

	// Touch screens show :active only while the finger is down, and some browsers apply it late,
	// so a quick tap could show no press at all. Mark the pressed control ourselves and keep the
	// mark for at least MIN_PRESS ms; main.css styles it like :active. A tap that turns into a
	// scroll drops the mark right away. The keypad and data-plain elements handle their own.
	const MIN_PRESS = 140;
	const markPress = (e: PointerEvent) => {
		const el = (e.target as Element | null)?.closest<HTMLElement>(
			"button, a[href], [role='button']",
		);
		if (!el || el.closest("[data-keypad], [data-plain]") || el.matches(":disabled")) return;
		el.dataset.pressed = "";
		const start = performance.now();
		const done = (scrolled: boolean) => {
			removeEventListener("pointerup", up);
			removeEventListener("pointercancel", cancel);
			const left = scrolled ? 0 : MIN_PRESS - (performance.now() - start);
			setTimeout(() => delete el.dataset.pressed, Math.max(0, left));
		};
		const up = () => done(false);
		const cancel = () => done(true);
		addEventListener("pointerup", up);
		addEventListener("pointercancel", cancel);
	};
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="px-4">
	{@render children()}
</div>
<OfflineBanner />
{#if page.data.userUuid && !page.url.pathname.startsWith("/oauth/")}
	<TabBar />
{/if}
<Toasts />
<svelte:window onpointerdown={markPress} />
