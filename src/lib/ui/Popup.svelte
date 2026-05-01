<script lang="ts">
	import { fade, fly } from "svelte/transition";

	let { title, showPopup = $bindable(true) } = $props();
</script>

{#if showPopup}
	<button
		transition:fade={{ duration: 200 }}
		onclick={() => (showPopup = false)}
		class="fixed left-0 top-0 h-[100dvh] w-screen border-none bg-black bg-opacity-60 z-40"
	></button>
	<section
		transition:fly={{ y: 1200, duration: 200, opacity: 1 }}
		class="fixed left-0 bottom-0 rounded-t-xl w-full h-60vh bg-[#171717] px-8 pt-5 box-border z-40"
		style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))"
	>
		<div class="flex justify-between items-center">
			<h1 class="text-2xl">{title}</h1>
			<button
				class="block i-heroicons-x-mark-16-solid size-8"
				onclick={() => (showPopup = false)}
			>
			</button>
		</div>
		<slot />
	</section>
{/if}
