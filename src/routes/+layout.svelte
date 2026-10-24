<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import "virtual:uno.css";
	import "./main.css";
	import Toasts from "$lib/ui/Toasts.svelte";
	import { page } from "$app/state";
	import TabBar from "./TabBar.svelte";

	let { children } = $props();

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
	<title>jimu</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="px-4">
	{@render children()}
</div>
{#if page.data.userUuid}
	<TabBar />
{/if}
<Toasts />
<svelte:window onpointerdown={markPress} />
