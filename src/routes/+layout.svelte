<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import "virtual:uno.css";
	import "./main.css";
	import { Button } from "bits-ui";
	import { idb, synced } from "./idb";

	let { children } = $props();

	const sync = async () => {
		const exercises = await idb.getAll("exercises");

		const res = await fetch("/", {
			method: "POST",
			body: JSON.stringify(exercises),
		});

		if (res.status !== 200) {
			alert("something went wrong syncing");
			return;
		}
		synced.set(true);
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="fixed right-6 top-6 flex gap-2">
	<section
		class="border-solid border-2 border-border-input bg-bg-alt rounded-lg h-10 px-2 flex justify-center items-center"
	>
		{new Date()
			.toLocaleString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			})
			.replace(",", "")}
	</section>
	<Button.Root
		href="/"
		class="cursor-pointer border-solid border-2 border-border-input bg-bg-alt rounded-lg size-10 flex justify-center items-center"
	>
		<i class="i-tabler-list block size-6"></i>
	</Button.Root>
	<Button.Root
		onclick={sync}
		class="cursor-pointer border-solid border-2 border-border-input bg-bg-alt rounded-lg size-10"
	>
		{#if $synced}
			<i class="i-tabler-cloud-check block size-6"></i>
		{:else}
			<i class="i-tabler-cloud-x block size-6"></i>
		{/if}
	</Button.Root>
	<Button.Root
		href="/settings"
		class="cursor-pointer border-solid border-2 border-border-input bg-bg-alt rounded-lg size-10 flex justify-center items-center"
	>
		<i class="i-tabler-settings block size-6"></i>
	</Button.Root>
</nav>
<div class="h-10"></div>
{@render children()}
