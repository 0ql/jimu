<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		label = "",
		cl = "",
		children,
	}: { label?: string; cl?: string; children?: Snippet } = $props();
</script>

<section class="border-solid border-muted border-1 rounded-lg p-3 px-4 {cl}">
	{#if label}
		<p class="text-xs color-fg-alt mb-1">{label}</p>
	{/if}
	{@render children?.()}
</section>
