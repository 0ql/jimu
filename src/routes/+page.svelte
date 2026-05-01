<script lang="ts">
	import { onMount } from "svelte";
	import {
		type DB,
		type Exercise,
		exercises,
		getAll,
		loadDB,
		loadExercises,
		synced,
	} from "./idb";
	import type { IDBPDatabase } from "idb";
	import type { PageProps } from "./$types";

	import ExerciseComponent from "./Exercise.svelte";
	import Nav from "./Nav.svelte";

	let searchString: string = $state("");
	let db: IDBPDatabase<DB>;
	let { data }: PageProps = $props();

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
		db = await loadDB();
		await loadExercises();
		if ($exercises.length === 0 && !data.hash) {
			console.log("No Exercises stored locally and none on server");
			return;
		}
		if ($exercises.length === 0) {
			console.log(
				"No Exercises found locally. But Server has Exercises. Syncing from server...",
			);
			return syncFromServer();
		}
		const hash = await createHash(JSON.stringify(exercises));
		const meta = await getAll("meta");
		if (data.hash !== hash) {
			// @ts-ignore
			if ((data.lastModified ?? new Date(0)) > new Date(meta[0]?.lastChanged)) {
				console.log("Server version is newer. Syncing from server...");
				return syncFromServer();
			}
			console.log("Local version is up to date.");
		}
	});
</script>

<main class="p-4">
	<div class="mt-36">
		{#each $exercises as exercise}
			{#if exercise.title
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.includes(searchString
						.toLowerCase()
						.normalize("NFD")
						.replace(/[\u0300-\u036f]/g, ""))}
				<ExerciseComponent {exercise} />
			{/if}
		{/each}
	</div>
</main>

<Nav bind:searchString />
