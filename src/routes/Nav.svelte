<script lang="ts">
	import "virtual:uno.css";
	import "./main.css";
	import { page } from "$app/state";
	import { synced, syncToServer } from "./idb";
	import type { Snippet } from "svelte";

	// Phones get the tabs as a bar at the bottom of the screen; the top only holds what a page
	// passes in (the exercise search). Desktop keeps one bar at the top with the add button.
	let {
		onadd = undefined,
		addLabel = "New exercise",
		children = undefined,
	}: { onadd?: () => void; addLabel?: string; children?: Snippet } = $props();

	// Pages offset their content by the bars' real heights (border included) via --nav-h at the
	// top and --tab-h at the bottom. A ResizeObserver catches every change, e.g. the search row
	// leaving or the tab bar hiding when the layout goes wide.
	const trackHeight = (el: HTMLElement, name: string) => {
		const update = () => document.documentElement.style.setProperty(name, `${el.offsetHeight}px`);
		const observer = new ResizeObserver(update);
		observer.observe(el);
		update();
		return () => {
			observer.disconnect();
			document.documentElement.style.setProperty(name, "0px");
		};
	};
	let navEl: HTMLElement | undefined = $state();
	let tabsEl: HTMLElement | undefined = $state();
	$effect(() => (navEl ? trackHeight(navEl, "--nav-h") : undefined));
	$effect(() => (tabsEl ? trackHeight(tabsEl, "--tab-h") : undefined));

	const links = [
		{ href: "/routines", label: "Routines", icon: "i-tabler-list" },
		{ href: "/sessions", label: "Sessions", icon: "i-tabler-history" },
		{ href: "/analytics", label: "Analytics", icon: "i-tabler-chart-bar" },
		{ href: "/settings", label: "Settings", icon: "i-tabler-adjustments-horizontal" },
	];
	const tabs = [{ href: "/", label: "Exercises", icon: "i-tabler-barbell" }, ...links];
	// The admin page is reached from Settings, so Settings stays lit there.
	const isActive = (href: string) =>
		href === "/"
			? page.url.pathname === "/"
			: page.url.pathname.startsWith(href) ||
				(href === "/settings" && page.url.pathname.startsWith("/admin"));
</script>

<nav
	bind:this={navEl}
	class="fixed left-0 right-0 top-0 z-30 px-4 lg:px-8 lg:pb-3.5 lg:[--nav-pt:1.25rem] bg-bg flex flex-col gap-3 {children
		? '[--nav-pt:1rem] pb-3 border-b-solid border-b-1 border-b-[#1a1a1d]'
		: '[--nav-pt:0px] lg:border-b-solid lg:border-b-1 lg:border-b-[#1a1a1d]'}"
	style="padding-top: calc(var(--nav-pt) + env(safe-area-inset-top))"
>
	<header class="hidden lg:flex items-center w-full max-w-[1376px] mx-auto">
		<div class="flex items-center flex-1 gap-1">
			<a
				href="/"
				aria-current={page.url.pathname === "/" ? "page" : undefined}
				class="flex h-10 px-3.5 rounded-[10px] items-center gap-2 no-underline text-[15px] {page.url
					.pathname === '/'
					? 'bg-surface-3 font-semibold'
					: 'text-[#c9c9cf]'}"
			>
				<i class="i-tabler-barbell block size-[18px]"></i>Exercises
			</a>
			{#each links as link}
				{@const active = isActive(link.href)}
				<a
					href={link.href}
					aria-label={link.label}
					aria-current={active ? "page" : undefined}
					class="h-10 px-3.5 rounded-[10px] flex items-center justify-center gap-2 no-underline {active
						? 'bg-surface-3'
						: ''}"
				>
					<i class="{link.icon} block size-[18px] {active ? 'text-fg' : 'text-[#c9c9cf]'}"></i>
					<span class="text-[15px] {active ? 'font-semibold' : 'text-[#c9c9cf]'}">{link.label}</span
					>
				</a>
			{/each}
			<div class="flex items-center gap-3 ml-auto">
				<button
					onclick={syncToServer}
					aria-label={$synced ? "Synced" : "Not synced, sync now"}
					class="flex h-10 px-2 border-none bg-transparent cursor-pointer items-center gap-1.5 text-[13px] text-subtle"
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
						class="flex h-10 px-4 rounded-[10px] border-none bg-signal cursor-pointer items-center justify-center gap-2"
					>
						<i class="i-tabler-plus block size-[18px] text-[#111]"></i>
						<span class="whitespace-nowrap text-[15px] font-semibold text-[#111]">{addLabel}</span>
					</button>
				{/if}
			</div>
		</div>
	</header>

	{@render children?.()}
</nav>

<nav
	bind:this={tabsEl}
	aria-label="Tabs"
	class="lg:hidden fixed left-0 right-0 bottom-0 z-30 grid bg-[#111113] border-t-solid border-t-1 border-t-[#1f1f23]"
	style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr)); padding-bottom: env(safe-area-inset-bottom)"
>
	{#each tabs as tab (tab.href)}
		{@const active = isActive(tab.href)}
		<a
			href={tab.href}
			aria-current={active ? "page" : undefined}
			class="relative h-[68px] flex flex-col items-center justify-center gap-1 no-underline text-xs {active
				? 'text-fg font-semibold'
				: 'text-faint'}"
		>
			{#if active}
				<span class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-signal"
				></span>
			{/if}
			<span class="relative">
				<i class="{tab.icon} block size-[26px]"></i>
				{#if tab.href === "/settings" && !$synced}
					<span
						class="absolute -top-0.5 -right-1 size-2 rounded-full bg-destructive ring-2 ring-[#111113]"
						title="Not synced"
					></span>
				{/if}
			</span>
			<span class="max-w-full truncate px-0.5">{tab.label}</span>
		</a>
	{/each}
</nav>
