<script lang="ts">
	import "virtual:uno.css";
	import "./main.css";
	import { Button } from "bits-ui";
	import { idb, synced } from "./idb";

	let {
		searchString = $bindable(""),
		onadd = undefined,
	}: { searchString?: string; onadd?: () => void } = $props();

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

	let currentTime = $state("");
	const updateTime = () => {
		currentTime = new Date()
			.toLocaleString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			})
			.replace(",", "");
	};

	updateTime();
	setInterval(updateTime, 1000);
</script>

<nav class="fixed left-0 right-0 top-0 p-4 bg-bg shadow-xl shadow-bg">
	<div class="flex gap-2">
		<section
			class="border-solid border-1 border-border-input bg-bg rounded-lg h-10 px-2 flex justify-center items-center"
		>
			{currentTime}
		</section>
		<Button.Root
			href="/"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-list block size-6"></i>
		</Button.Root>
		<Button.Root
			href="/analytics"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-device-analytics block size-6"></i>
		</Button.Root>
		<Button.Root
			onclick={sync}
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			{#if $synced}
				<i class="i-tabler-cloud-check bg-green-400 block size-6"></i>
			{:else}
				<i class="i-tabler-cloud-x bg-destructive block size-6"></i>
			{/if}
		</Button.Root>
		<Button.Root
			href="/settings"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-settings block size-6"></i>
		</Button.Root>
		{#if onadd}
			<Button.Root
				onclick={onadd}
				class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center ml-auto"
			>
				<i class="i-tabler-plus block size-6"></i>
			</Button.Root>
		{/if}
	</div>

	<input
		placeholder="Search..."
		class="w-full mt-4 bg-bg rounded-lg border-solid border-1 border-border-input px-6 py-3 text-xl outline-none"
		bind:value={searchString}
	/>
</nav>
