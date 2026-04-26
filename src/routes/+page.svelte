<script lang="ts">
	import { onMount } from "svelte";
	import { type DB, type Exercise, loadDB, saveExercise, synced } from "./idb";
	import type { IDBPDatabase } from "idb";
	import type { PageProps } from "./$types";
	import { Button } from "bits-ui";
	import Btn from "$lib/ui/Button.svelte";
	import Popup from "$lib/ui/Popup.svelte";

	let searchString: string = $state("");
	let exercises: Exercise[] = $state([]);
	let db: IDBPDatabase<DB>;

	let { data }: PageProps = $props();

	const loadExercises = async () => {
		db = await loadDB();
		exercises = await db.getAll("exercises");
	};

	const createHash = async (json: string): Promise<string> => {
		const encoded = new TextEncoder().encode(json);
		const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	};

	const syncFromServer = async () => {
		const res = await fetch("/");
		const jsn = await res.json();
		console.log(jsn);
		await db.clear("exercises");
		jsn.forEach(async (exercise: Exercise) => {
			await db.add("exercises", {
				title: exercise.title,
				workoutsString: exercise.workoutsString,
			});
		});
		await db.put("meta", {
			id: 1,
			lastChanged: Date.now(),
		});
		synced.set(true);
		loadExercises();
	};

	onMount(async () => {
		await loadExercises();
		if (exercises.length === 0 && !data.hash) {
			console.log("No Exercises stored locally and none on server");
			return;
		}
		if (exercises.length === 0) {
			console.log(
				"No Exercises found locally. But Server has Exercises. Syncing from server...",
			);
			return syncFromServer();
		}
		const hash = await createHash(JSON.stringify(exercises));
		const meta = await db.getAll("meta");
		if (data.hash !== hash) {
			if ((data.lastModified ?? new Date(0)) > new Date(meta[0]?.lastChanged)) {
				console.log("Server version is newer. Syncing from server...");
				return syncFromServer();
			}
			console.log("Local version is up to date.");
		}
	});

	let focusedTextarea = $state(false);
	const addTime = () => {};
	let showPopup = $state(false);
</script>

<main class="p-4">
	{#each exercises as exercise}
		{#if exercise.title.includes(searchString.toLowerCase())}
			<section
				class="border-solid border-muted border-1 rounded-lg p-3 px-4 mt-4"
			>
				<h2
					class="text-base font-bold my-1 flex gap-2 items-center justify-between"
				>
					<input
						spellcheck="false"
						bind:value={exercise.title}
						onchange={() => saveExercise(exercise)}
						class="bg-transparent text-current border-none text-lg font-semibold outline-none"
					/>
					<button
						onclick={() => (showPopup = !showPopup)}
						class="i-heroicons-ellipsis-vertical-16-solid size-5 block"
					></button>
				</h2>
				<details>
					<summary
						class="py-3 cursor-pointer text-sm font-semibold list-none color-fg-alt"
						>Show...</summary
					>
					<textarea
						spellcheck="false"
						class="w-full bg-transparent text-foreground border-none outline-none text-1rem"
						onchange={() => saveExercise(exercise)}
						bind:value={exercise.workoutsString}
						onfocusin={() => (focusedTextarea = true)}
						onfocusout={() => (focusedTextarea = false)}
					></textarea>
				</details>
			</section>
		{/if}
	{/each}

	<nav class="fixed left-2 bottom-2 right-2 flex gap-2">
		<input
			placeholder="Search..."
			class="w-full bg-bg rounded-lg border-solid border-2 border-border-input px-6 py-3 text-xl outline-none"
			bind:value={searchString}
		/>
		{#if focusedTextarea}
			<Button.Root
				class="bg-transparent border-solid border-2 border-border-input rounded-lg"
				onclick={addTime}
			>
				<i class="block i-tabler-clock-plus size-6 text-white w-10"></i>
			</Button.Root>
		{/if}
	</nav>

	<Popup title="Edit Exercise" bind:showPopup>
		<Btn onclick={deleteExercise} cl="bg-destructive">Delete Exercise</Btn>
	</Popup>
</main>
