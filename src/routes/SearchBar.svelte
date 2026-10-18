<script lang="ts">
	let { value = $bindable("") }: { value?: string } = $props();
</script>

<label
	class="flex items-center gap-2.5 h-12 pl-3.5 pr-1.5 rounded-xl bg-surface border-solid border-1 border-hairline"
>
	<i class="i-tabler-search block size-5 shrink-0 text-subtle"></i>
	<input
		type="search"
		bind:value
		aria-label="Search exercises"
		placeholder="Search or create exercise"
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
	{/if}
</label>
