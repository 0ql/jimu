<script lang="ts">
	import Input from "$lib/ui/Input.svelte";

	let { value = $bindable("") }: { value?: string } = $props();
</script>

<Input placeholder="Search..." bind:value cl="mt-4 px-6 text-xl" />
