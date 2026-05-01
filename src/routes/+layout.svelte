<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import "virtual:uno.css";
	import "./main.css";
	import Toasts from "$lib/ui/Toasts.svelte";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
<Toasts />
