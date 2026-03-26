<script lang="ts">
	import { onMount } from "svelte";
	import { type DB, type Exercise, loadDB } from "./db";
	import type { IDBPDatabase } from "idb";
	import Gear from "phosphor-svelte/lib/Gear";

	let searchString: string = $state("");
	let exercises: Exercise[] = $state([]);
	let db: IDBPDatabase<DB>;

	onMount(async () => {
		db = await loadDB();
		exercises = await db.getAll("exercises");
	});

	const save = (exercise: Exercise) => {
		db.put("exercises", { ...exercise });
	};
</script>

<main class="p-4">
	<nav class="fixed right-6 top-6">
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
				onchange={() => save(exercise)}
				bind:value={exercise.workoutsString}
			></textarea>
		{/if}
	{/each}
</main>
