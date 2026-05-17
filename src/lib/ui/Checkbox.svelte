<script lang="ts">
	let {
		checked = $bindable(false),
		label = "",
		cl = "",
		...rest
	}: { checked?: boolean; label?: string; cl?: string; [key: string]: any } = $props();
</script>

<label class="flex items-center gap-3 cursor-pointer select-none {cl}">
	<input type="checkbox" bind:checked {...rest} class="sr-only" />
	<span
		class="size-5 rounded flex-shrink-0 flex items-center justify-center border-solid border-1 transition-colors
			{checked ? 'bg-dark border-dark' : 'bg-bg border-muted'}"
	>
		{#if checked}
			<i class="block i-tabler-check size-3 bg-bg"></i>
		{/if}
	</span>
	{#if label}
		<span class="text-sm">{label}</span>
	{/if}
</label>
