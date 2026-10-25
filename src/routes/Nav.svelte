<script lang="ts">
	import { page } from "$app/state";
	import { synced, syncToServer } from "./idb";
	import type { Snippet } from "svelte";
	import { isActive, tabs } from "./TabBar.svelte";
	import { trackHeight } from "#lib/trackHeight.js";

	// Desktop has one bar at the top with the sections and the add button. On phones the top only
	// holds what a page passes in (the exercise search); the tabs are in TabBar, in the layout.
	let {
		onadd = undefined,
		addLabel = "New exercise",
		addMenu = undefined,
		children = undefined,
	}: {
		onadd?: () => void;
		addLabel?: string;
		/** A menu under the add button instead of `onadd`; it gets a function that closes it. */
		addMenu?: Snippet<[() => void]>;
		children?: Snippet;
	} = $props();

	let menuOpen = $state(false);
	const closeMenu = () => (menuOpen = false);

	// Pages offset their content by the bar's real height (border included) via --nav-h.
	let navEl: HTMLElement | undefined = $state();
	$effect(() => (navEl ? trackHeight(navEl, "--nav-h") : undefined));
</script>

<svelte:window onkeydown={(e) => menuOpen && e.key === "Escape" && closeMenu()} />

<nav
	bind:this={navEl}
	class="fixed left-0 right-0 top-0 z-30 px-4 lg:px-8 lg:pb-3.5 lg:[--nav-pt:1.25rem] bg-bg flex flex-col gap-3 {children
		? '[--nav-pt:0.5rem] pb-2 border-b-solid border-b-1 border-b-rule'
		: '[--nav-pt:0px] lg:border-b-solid lg:border-b-1 lg:border-b-rule'}"
	style="padding-top: calc(var(--nav-pt) + env(safe-area-inset-top) + var(--offline-h, 0px))"
>
	<header class="hidden lg:flex items-center w-full max-w-[1376px] mx-auto">
		<div class="flex items-center flex-1 gap-1">
			{#each tabs as link}
				{@const active = isActive(page.url.pathname, link.href)}
				<a
					href={link.href}
					aria-label={link.label}
					aria-current={active ? "page" : undefined}
					class="h-10 px-3.5 rounded-[10px] flex items-center justify-center gap-2 no-underline {active
						? 'bg-surface-3'
						: ''}"
				>
					<i class="{link.icon} block size-[18px] {active ? 'text-fg' : 'text-soft'}"></i>
					<span class="text-[15px] {active ? 'font-semibold' : 'text-soft'}">{link.label}</span>
				</a>
			{/each}
			<div class="flex items-center gap-3 ml-auto">
				<button
					onclick={syncToServer}
					aria-label={$synced ? "Synced" : "Not synced, sync now"}
					class="flex h-10 px-2 border-none bg-transparent cursor-pointer items-center gap-1.5 text-[13px] text-subtle"
				>
					{#if $synced}
						<i class="i-tabler-cloud-check block size-4 text-ok"></i>
						<span class="hidden xl:inline" aria-hidden="true">Synced</span>
					{:else}
						<i class="i-tabler-cloud-x block size-4 text-destructive"></i>
						<span class="hidden xl:inline" aria-hidden="true">Not synced · sync now</span>
					{/if}
				</button>
				{#if addMenu}
					<div class="relative">
						<button
							onclick={() => (menuOpen = !menuOpen)}
							aria-expanded={menuOpen}
							aria-haspopup="menu"
							class="flex h-10 pl-3.5 pr-3 rounded-[10px] border-none bg-signal cursor-pointer items-center justify-center gap-2 {menuOpen
								? 'shadow-[0_0_0_3px_color-mix(in_srgb,var(--signal)_25%,transparent)]'
								: ''}"
						>
							<i class="i-tabler-plus block size-[18px] text-on-signal"></i>
							<span class="whitespace-nowrap text-[15px] font-semibold text-on-signal"
								>{addLabel}</span
							>
							<i class="i-tabler-chevron-down block size-4 text-on-signal"></i>
						</button>
						{#if menuOpen}
							<button
								onclick={closeMenu}
								aria-label="Close menu"
								data-plain
								class="fixed inset-0 z-40 border-none bg-transparent cursor-default"
							></button>
							<div
								role="menu"
								class="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] p-2 rounded-2xl bg-surface border-solid border-1 border-popup-edge shadow-popover flex flex-col gap-0.5"
							>
								{@render addMenu(closeMenu)}
							</div>
						{/if}
					</div>
				{:else if onadd}
					<button
						onclick={onadd}
						aria-label={addLabel}
						class="flex h-10 px-4 rounded-[10px] border-none bg-signal cursor-pointer items-center justify-center gap-2"
					>
						<i class="i-tabler-plus block size-[18px] text-on-signal"></i>
						<span class="whitespace-nowrap text-[15px] font-semibold text-on-signal"
							>{addLabel}</span
						>
					</button>
				{/if}
			</div>
		</div>
	</header>

	{@render children?.()}
</nav>
