<script lang="ts">
	import { fade, fly, scale } from "svelte/transition";
	import { onMount } from "svelte";
	import type { Snippet } from "svelte";
	import type { TransitionConfig } from "svelte/transition";

	let {
		title,
		showPopup = $bindable(true),
		children,
	}: { title: string; showPopup?: boolean; children?: Snippet } = $props();

	let isMobile = $state(true);

	onMount(() => {
		const mq = window.matchMedia("(max-width: 639px)");
		isMobile = mq.matches;
		mq.addEventListener("change", (e) => (isMobile = e.matches));
	});

	const popupTransition = (node: Element): TransitionConfig => {
		if (isMobile) return fly(node, { y: 600, duration: 250, opacity: 1 });
		return scale(node, { duration: 200, start: 0.95 });
	};
</script>

{#if showPopup}
	<button
		transition:fade={{ duration: 200 }}
		onclick={() => (showPopup = false)}
		aria-label="Close popup"
		class="fixed inset-0 h-[100dvh] w-screen border-none bg-black bg-opacity-60 z-40 cursor-pointer"
	></button>

	<section
		transition:popupTransition
		class="fixed z-40 bg-surface border-solid border-1 border-[#2a2a30] box-border overflow-y-auto
			{isMobile
			? 'left-0 bottom-0 rounded-t-[22px] w-full max-h-[85dvh] px-5 pt-2 border-b-none'
			: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[85dvh] rounded-2xl px-6 py-5'}"
		style={isMobile ? "padding-bottom: calc(1.75rem + env(safe-area-inset-bottom))" : ""}
	>
		{#if isMobile}
			<div class="flex justify-center pb-2">
				<span class="w-10 h-[5px] rounded-full bg-[#3a3a41]"></span>
			</div>
		{/if}
		<div class="flex justify-between items-center mb-2">
			<!-- <PageTitle cl={isMobile ? "my-4" : "text-sm"}>{title}</PageTitle> -->
			<h1 class="font-cond font-bold m-0 text-[26px]">{title}</h1>
			<button
				class="border-none bg-transparent cursor-pointer"
				aria-label="Close"
				onclick={() => (showPopup = false)}
			>
				<i class="block i-heroicons-x-mark-16-solid size-7 text-subtle"></i>
			</button>
		</div>
		{@render children?.()}
	</section>
{/if}
