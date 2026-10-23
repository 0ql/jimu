<script lang="ts">
	let {
		value = $bindable(""),
		input = $bindable(),
		hint = "",
		placeholder = "Search or create exercise",
		label = "Search exercises",
		onkeydown,
	}: {
		value?: string;
		input?: HTMLInputElement;
		hint?: string;
		placeholder?: string;
		label?: string;
		onkeydown?: (e: KeyboardEvent) => void;
	} = $props();
</script>

<label
	class="flex items-center gap-2.5 h-12 p-3 rounded-xl bg-surface border-solid border-1 border-hairline"
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
		class="flex-1 min-w-0 h-full border-none outline-none bg-transparent text-base placeholder:text-[#7c7c85] [&::-webkit-search-cancel-button]:hidden"
	/>
	{#if value}
		<button
			onclick={() => (value = "")}
			aria-label="Clear search"
			class="size-9 shrink-0 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center justify-center"
		>
			<i class="i-tabler-x block size-4 text-[#c9c9cf]"></i>
		</button>
	{:else if hint}
		<kbd class="mr-1.5">{hint}</kbd>
	{/if}
</label>
