<script lang="ts" module>
	/** The app's sections, in nav order; Exercises (/) leads the phone tab bar. */
	export const links = [
		{ href: "/sessions", label: "Sessions", icon: "i-tabler-history" },
		{ href: "/routines", label: "Routines", icon: "i-tabler-list" },
		{ href: "/analytics", label: "Analytics", icon: "i-tabler-chart-bar" },
		{ href: "/settings", label: "Settings", icon: "i-tabler-adjustments-horizontal" },
	];
	export const tabs = [{ href: "/", label: "Exercises", icon: "i-tabler-barbell" }, ...links];

	/** Whether a nav entry is the current section. The admin page is reached from Settings. */
	export const isActive = (pathname: string, href: string) =>
		href === "/"
			? pathname === "/"
			: pathname.startsWith(href) || (href === "/settings" && pathname.startsWith("/admin"));
</script>

<script lang="ts">
	import { page } from "$app/state";
	import { synced } from "./idb";
	import { trackHeight } from "#lib/trackHeight.js";

	// The phone tab bar lives in the layout, not in each page, so it stays put while switching
	// tabs: the pressed tab finishes its press animation instead of being rebuilt mid-tap.
	// Pages leave room for it via --tab-h (see main.css).
	let tabsEl: HTMLElement | undefined = $state();
	$effect(() => (tabsEl ? trackHeight(tabsEl, "--tab-h") : undefined));
</script>

<nav
	bind:this={tabsEl}
	aria-label="Tabs"
	class="lg:hidden fixed left-0 right-0 bottom-0 z-30 grid bg-tabbar border-t-solid border-t-1 border-t-divider-2"
	style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr)); padding-bottom: env(safe-area-inset-bottom)"
>
	{#each tabs as tab (tab.href)}
		{@const active = isActive(page.url.pathname, tab.href)}
		<a
			href={tab.href}
			aria-current={active ? "page" : undefined}
			class="h-[78px] flex flex-col items-center justify-center gap-1.5 no-underline"
		>
			<!-- The current tab's icon sits in a soft pill; colors are set on each part because
			     main.css gives every element the foreground color rather than inheriting it. -->
			<span
				class="relative w-16 h-9 rounded-full flex items-center justify-center transition-colors {active
					? 'bg-selected'
					: ''}"
			>
				<i class="{tab.icon} block size-7 {active ? 'text-fg' : 'text-faint'}"></i>
				{#if tab.href === "/settings" && !$synced}
					<span
						class="absolute top-1 right-3.5 size-2.5 rounded-full bg-destructive ring-2 ring-tabbar"
						title="Not synced"
					></span>
				{/if}
			</span>
			<span
				class="max-w-full truncate px-0.5 text-[13px] {active
					? 'text-fg font-semibold'
					: 'text-faint'}">{tab.label}</span
			>
		</a>
	{/each}
</nav>
