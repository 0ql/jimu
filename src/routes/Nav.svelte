<script lang="ts">
	import "virtual:uno.css";
	import "./main.css";
	import { page } from "$app/state";
	import { synced, syncToServer } from "./idb";
	import { dateStamp } from "$lib/sets";
	import type { Snippet } from "svelte";

	let {
		onadd = undefined,
		addLabel = "New exercise",
		children = undefined,
	}: { onadd?: () => void; addLabel?: string; children?: Snippet } = $props();

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
	class="fixed left-0 right-0 top-0 z-30 px-4 lg:px-8 pt-5 pb-3 lg:pb-3.5 bg-bg border-b-solid border-b-1 border-b-[#1a1a1d] flex flex-col gap-3"
	style="padding-top: calc(1.25rem + env(safe-area-inset-top))"
>
	<header
		class="flex items-center justify-between gap-2 lg:gap-8 w-full lg:max-w-[1376px] lg:mx-auto"
	>
		<div class="flex items-center gap-1 min-w-0 lg:shrink-0">
			<a
				href="/"
				class="flex flex-col lg:flex-row lg:items-baseline lg:gap-2.5 no-underline"
				aria-label="Exercises"
			>
				<span
					class="font-display font-semibold text-[26px] lg:text-[24px] leading-none tracking-[-0.01em]"
					>{dateStamp(now)}</span
				>
				<span class="text-[13px] lg:hidden xl:inline xl:text-sm text-subtle">{weekday}</span>
			</a>
			<button
				onclick={syncToServer}
				aria-label={$synced ? "Synced" : "Not synced, sync now"}
				class="lg:hidden size-10 self-end -mb-1.5 border-none bg-transparent cursor-pointer flex items-center justify-center"
			>
				{#if $synced}
					<i class="i-tabler-cloud-check block size-4 text-green-400"></i>
				{:else}
					<i class="i-tabler-cloud-x block size-4 text-destructive"></i>
				{/if}
			</button>
		</div>
		<div class="flex items-center lg:flex-1 lg:gap-1">
			<a
				href="/"
				aria-current={page.url.pathname === "/" ? "page" : undefined}
				class="hidden lg:flex h-10 px-3.5 rounded-[10px] items-center gap-2 no-underline text-[15px] {page
					.url.pathname === '/'
					? 'bg-surface-3 font-semibold'
					: 'text-[#c9c9cf]'}"
			>
				<i class="i-tabler-barbell block size-[18px]"></i>Exercises
			</a>
			{#each links as link}
				{@const active = page.url.pathname.startsWith(link.href)}
				<a
					href={link.href}
					aria-label={link.label}
					aria-current={active ? "page" : undefined}
					class="size-11 lg:size-auto lg:h-10 lg:px-3.5 rounded-xl lg:rounded-[10px] flex items-center justify-center lg:gap-2 no-underline {active
						? 'bg-surface-3'
						: ''}"
				>
					<i
						class="{link.icon} block size-[22px] lg:size-[18px] {active
							? 'text-fg'
							: 'text-[#c9c9cf]'}"
					></i>
					<span class="hidden lg:inline text-[15px] {active ? 'font-semibold' : 'text-[#c9c9cf]'}"
						>{link.label}</span
					>
				</a>
			{/each}
			<div class="flex items-center gap-3 lg:ml-auto">
				<button
					onclick={syncToServer}
					aria-label={$synced ? "Synced" : "Not synced, sync now"}
					class="hidden lg:flex h-10 px-2 border-none bg-transparent cursor-pointer items-center gap-1.5 text-[13px] text-subtle"
				>
					{#if $synced}
						<i class="i-tabler-cloud-check block size-4 text-green-400"></i>
						<span class="hidden xl:inline" aria-hidden="true">Synced</span>
					{:else}
						<i class="i-tabler-cloud-x block size-4 text-destructive"></i>
						<span class="hidden xl:inline" aria-hidden="true">Not synced · sync now</span>
					{/if}
				</button>
				{#if onadd}
					<button
						onclick={onadd}
						aria-label={addLabel}
						class="size-11 lg:size-auto lg:h-10 lg:px-4 ml-1 lg:ml-0 rounded-xl lg:rounded-[10px] border-none bg-signal cursor-pointer flex items-center justify-center gap-2"
					>
						<i class="i-tabler-plus block size-[22px] lg:size-[18px] text-[#111]"></i>
						<span class="hidden lg:inline whitespace-nowrap text-[15px] font-semibold text-[#111]"
							>{addLabel}</span
						>
					</button>
				{/if}
			</div>
		</div>
	</header>

	{@render children?.()}
</nav>
