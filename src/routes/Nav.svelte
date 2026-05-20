<script lang="ts">
	import "virtual:uno.css";
	import "./main.css";
	import { synced, syncToServer } from "./idb";
	import type { Snippet } from "svelte";

	let { onadd = undefined, children = undefined }: { onadd?: () => void; children?: Snippet } =
		$props();

	let currentTime = $state("");
	const updateTime = () => {
		currentTime = new Date()
			.toLocaleString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
				// hour: "2-digit",
				// minute: "2-digit",
			})
			.replace(",", "");
	};

	updateTime();
	setInterval(updateTime, 1000);
</script>

<nav class="fixed left-0 right-0 top-0 px-6 pt-6 bg-bg shadow-xl shadow-bg">
	<div class="flex gap-2">
		<section
			class="border-solid border-1 border-border-input bg-bg rounded-lg h-10 px-2 flex justify-center items-center"
		>
			{currentTime}
		</section>
		<a
			href="/"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-list block size-6"></i>
		</a>
		<a
			href="/routines"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-list-check block size-6"></i>
		</a>
		<a
			href="/sessions"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-history block size-6"></i>
		</a>
		<a
			href="/analytics"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-device-analytics block size-6"></i>
		</a>
		<button
			onclick={syncToServer}
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			{#if $synced}
				<i class="i-tabler-cloud-check bg-green-400 block size-6"></i>
			{:else}
				<i class="i-tabler-cloud-x bg-destructive block size-6"></i>
			{/if}
		</button>
		<a
			href="/settings"
			class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center"
		>
			<i class="i-tabler-settings block size-6"></i>
		</a>
		{#if onadd}
			<button
				onclick={onadd}
				class="cursor-pointer border-solid border-1 border-border-input bg-bg rounded-lg size-10 flex justify-center items-center ml-auto"
			>
				<i class="i-tabler-plus block size-6"></i>
			</button>
		{/if}
	</div>

	{@render children?.()}
</nav>
