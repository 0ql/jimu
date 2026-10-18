<script lang="ts">
	import "virtual:uno.css";
	import "./main.css";
	import { page } from "$app/state";
	import { synced, syncToServer } from "./idb";
	import { dateStamp } from "$lib/sets";
	import type { Snippet } from "svelte";

	let { onadd = undefined, children = undefined }: { onadd?: () => void; children?: Snippet } =
		$props();

	let now = $state(new Date());
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});
	const weekday = $derived(now.toLocaleDateString("en-US", { weekday: "long" }));

	// Pages offset their content by the nav's real height via --nav-h.
	let height = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty("--nav-h", `${height}px`);
	});

	const links = [
		{ href: "/routines", label: "Routines", icon: "i-tabler-list" },
		{ href: "/sessions", label: "Sessions", icon: "i-tabler-history" },
		{ href: "/analytics", label: "Analytics", icon: "i-tabler-chart-bar" },
		{ href: "/settings", label: "Settings", icon: "i-tabler-adjustments-horizontal" },
	];
</script>

<nav
	bind:clientHeight={height}
	class="fixed left-0 right-0 top-0 z-30 px-4 pt-5 pb-3 bg-bg border-b-solid border-b-1 border-b-[#1a1a1d] flex flex-col gap-3"
	style="padding-top: calc(1.25rem + env(safe-area-inset-top))"
>
	<header class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-1 min-w-0">
			<a href="/" class="flex flex-col no-underline" aria-label="Exercises">
				<span class="font-cond font-bold text-[34px] leading-none tracking-wide"
					>{dateStamp(now)}</span
				>
				<span class="text-[13px] text-subtle">{weekday}</span>
			</a>
			<button
				onclick={syncToServer}
				aria-label={$synced ? "Synced" : "Not synced, sync now"}
				class="size-10 self-end -mb-1.5 border-none bg-transparent cursor-pointer flex items-center justify-center"
			>
				{#if $synced}
					<i class="i-tabler-cloud-check block size-4 text-green-400"></i>
				{:else}
					<i class="i-tabler-cloud-x block size-4 text-destructive"></i>
				{/if}
			</button>
		</div>
		<div class="flex items-center">
			{#each links as link}
				{@const active = page.url.pathname.startsWith(link.href)}
				<a
					href={link.href}
					aria-label={link.label}
					aria-current={active ? "page" : undefined}
					class="size-11 rounded-xl flex items-center justify-center {active ? 'bg-surface-3' : ''}"
				>
					<i class="{link.icon} block size-[22px] {active ? 'text-fg' : 'text-[#c9c9cf]'}"></i>
				</a>
			{/each}
			{#if onadd}
				<button
					onclick={onadd}
					aria-label="New exercise"
					class="size-11 ml-1 rounded-xl border-none bg-signal cursor-pointer flex items-center justify-center"
				>
					<i class="i-tabler-plus block size-[22px] text-[#111]"></i>
				</button>
			{/if}
		</div>
	</header>

	{@render children?.()}
</nav>
