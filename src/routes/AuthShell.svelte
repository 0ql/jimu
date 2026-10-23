<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title,
		error = "",
		onsubmit,
		children,
		footer,
	}: {
		title: string;
		error?: string;
		onsubmit: () => void;
		children: Snippet;
		footer: Snippet;
	} = $props();
</script>

<!-- 100dvh is the visible height on phones (100vh includes the area under the address bar). -->
<main class="h-[100dvh] overflow-y-auto flex flex-col items-center justify-center gap-8 py-6">
	<div class="flex flex-col items-center gap-2 text-center">
		<span class="font-display font-semibold text-[44px] leading-none tracking-[-0.02em]"
			>jimu<span class="text-signal">.</span></span
		>
		<span class="font-mono text-[13px] text-subtle">
			<span class="text-faint">18.10.</span>
			<span class="text-faint">a10x12</span> 30x10 x8 <span class="text-drop">d15x7</span>
		</span>
	</div>

	<form
		class="w-full max-w-sm flex flex-col gap-4 p-5 rounded-2xl bg-surface border-solid border-1 border-hairline"
		onsubmit={(e) => {
			e.preventDefault();
			onsubmit();
		}}
	>
		<h1 class="m-0 font-display font-semibold text-[22px] leading-tight">{title}</h1>
		{@render children()}
		{#if error}
			<p
				role="alert"
				class="m-0 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[rgba(244,62,92,0.12)] text-sm text-[#ff8a8a]"
			>
				<i class="i-tabler-alert-circle block size-[18px] shrink-0 mt-px text-[#ff8a8a]"></i>
				{error}
			</p>
		{/if}
	</form>

	<p class="m-0 text-sm text-subtle">{@render footer()}</p>
</main>
