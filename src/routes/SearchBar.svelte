<script lang="ts">
	let {
		value = $bindable(""),
		input = $bindable(),
		hint = "",
		placeholder = "Search or create exercise",
		label = "Search exercises",
		onkeydown,
		compact = false,
	}: {
		value?: string;
		input?: HTMLInputElement;
		hint?: string;
		placeholder?: string;
		label?: string;
		onkeydown?: (e: KeyboardEvent) => void;
		/** A slimmer 40px bar, for the phone's top bar. */
		compact?: boolean;
	} = $props();
</script>

<label
	class="flex items-center gap-2.5 {compact
		? 'h-10 pl-3 pr-1.5'
		: 'h-12 p-3'} rounded-xl bg-surface border-solid border-1 border-hairline"
>
	<i class="i-tabler-search block size-5 shrink-0 text-subtle"></i>
	<input
		type="search"
		bind:this={input}
		bind:value
		{onkeydown}
		aria-label={label}
		{placeholder}
		autocomplete="off"
		class="flex-1 min-w-0 h-full border-none outline-none bg-transparent text-base placeholder:text-dim [&::-webkit-search-cancel-button]:hidden"
	/>
	{#if value}
		<button
			onclick={() => (value = "")}
			aria-label="Clear search"
			class="{compact
				? 'size-7'
				: 'size-9'} shrink-0 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center justify-center"
		>
			<i class="i-tabler-x block size-4 text-soft"></i>
		</button>
	{:else if hint}
		<kbd class="mr-1.5">{hint}</kbd>
	{/if}
</label>
