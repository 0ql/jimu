<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import "virtual:uno.css";
	import "./main.css";
	import Toasts from "$lib/ui/Toasts.svelte";

	let { children } = $props();
</script>

<svelte:head>
	<title>jimu</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="px-10">
	{@render children()}
</div>
<Toasts />
