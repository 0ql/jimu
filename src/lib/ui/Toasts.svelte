<script lang="ts">
	import { toast } from "$lib/toast.svelte";
	import { fly } from "svelte/transition";

	const styles = {
		success: {
			icon: "i-tabler-circle-check",
			color: "border-accent text-ok",
		},
		error: {
			icon: "i-tabler-circle-x",
			color: "border-destructive text-destructive",
		},
		warning: {
			icon: "i-tabler-alert-triangle",
			color: "border-tertiary text-tertiary",
		},
	};
</script>

<div class="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
	{#each toast.list as t (t.id)}
		<div
			transition:fly={{ x: 60, duration: 200, opacity: 0 }}
			class="pointer-events-auto flex items-center gap-3 border-solid border-1 border-border-input rounded-lg px-4 py-3 bg-bg min-w-64 max-w-80 shadow-popover {styles[
				t.type
			].color}"
		>
			<i class="block size-5 shrink-0 {styles[t.type].icon}"></i>
			<span class="text-sm flex-1">{t.message}</span>
			<button
				onclick={() => toast.remove(t.id)}
				aria-label="Dismiss"
				class="i-tabler-x block size-4 shrink-0 opacity-40 hover:opacity-100 border-none bg-transparent cursor-pointer p-0"
			></button>
		</div>
	{/each}
</div>
