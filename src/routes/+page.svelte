<script lang="ts">
	import { onMount } from "svelte";
	import { type DB, type Exercise, loadDB, saveExercise, synced } from "./idb";
	import type { IDBPDatabase } from "idb";
	import Gear from "phosphor-svelte/lib/Gear";
	import Cloud from "phosphor-svelte/lib/Cloud";
	import CloudSlash from "phosphor-svelte/lib/CloudSlash";
	import type { PageProps } from "./$types";

	let searchString: string = $state("");
	let exercises: Exercise[] = $state([]);
	let db: IDBPDatabase<DB>;

	let { data }: PageProps = $props();

	const createHash = async (json: string): Promise<string> => {
		const encoded = new TextEncoder().encode(json);
		const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	};

	const sync = async () => {
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

	onMount(async () => {
		db = await loadDB();
		exercises = await db.getAll("exercises");
		const hash = await createHash(JSON.stringify(exercises));
		const meta = await db.getAll("meta");
		if (data.hash !== hash) {
			if ((data.lastModified ?? new Date(0)) > new Date(meta[0].lastChanged)) {
				console.log("server version is newer");
				const res = await fetch("/");
				const jsn = await res.json();
				console.log(jsn);
				jsn.forEach(async (exercise: Exercise) => {
					await db.clear("exercises");
					await db.add("exercises", {
						title: exercise.title,
						workoutsString: exercise.workoutsString,
					});
				});
				await db.put("meta", {
					id: 1,
					lastChanged: Date.now(),
				});
			}
		}
	});
</script>

<main class="p-4">
	<nav class="fixed right-6 top-6">
		<button onclick={sync} class="bg-transparent border-none cursor-pointer">
			{#if $synced}
				<Cloud class="size-8 dark:text-white" />
			{:else}
				<CloudSlash class="size-8 dark:text-white" />
			{/if}
		</button>
		<a href="/settings" class="bg-transparent border-none cursor-pointer">
			<Gear class="size-8 dark:text-white" />
		</a>
	</nav>
	<nav class="fixed left-0 bottom-0 w-full">
		<input
			placeholder="Search..."
			class="w-full px-8 py-4 text-xl"
			bind:value={searchString}
		/>
	</nav>
	{#each exercises as exercise}
		{#if exercise.title.includes(searchString)}
			<h2 class="text-base font-bold">{exercise.title}</h2>
			<textarea
				spellcheck="false"
				class="w-full bg-transparent text-foreground border-none outline-none"
				onchange={() => saveExercise(exercise)}
				bind:value={exercise.workoutsString}
			></textarea>
		{/if}
	{/each}
</main>
