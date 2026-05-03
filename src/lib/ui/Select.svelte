<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		value = $bindable(),
		cl = "",
		children,
		...rest
	}: { value?: any; cl?: string; children?: Snippet; [key: string]: any } = $props();
</script>

<div class="relative {cl}">
	<select
		bind:value
		{...rest}
		class="w-full bg-bg rounded-lg border-solid border-1 border-border-input px-4 py-3 outline-none appearance-none cursor-pointer pr-10"
	>
		{@render children?.()}
	</select>
	<i
		class="i-tabler-chevron-down absolute right-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none color-fg-alt"
	></i>
</div>
