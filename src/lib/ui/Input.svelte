<script lang="ts">
	let { value = $bindable(""), cl = "", ...rest } = $props();
</script>

<input
	bind:value
	class="w-full bg-bg rounded-lg border-solid border-1 border-border-input px-4 py-3 text-base outline-none {cl}"
	{...rest}
/>
