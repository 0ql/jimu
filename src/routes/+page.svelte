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
	import { toast } from "$lib/toast.svelte";

	let searchString: string = $state("");
	let db: IDBPDatabase<DB>;
	let { data }: PageProps = $props();

	const createHash = (json: string): string => {
		let h = 0;
		for (let i = 0; i < json.length; i++) {
			h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
		}
		return (h >>> 0).toString(16);
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
			toast.success("No Exercises stored locally and none on server");
			return;
		}
		if ($exercises.length === 0) {
			toast.success(
				"No Exercises found locally. But Server has Exercises. Syncing from server...",
			);
			await syncFromServer();
			return loadExercises();
		}
		const hash = createHash(JSON.stringify(exercises));
		const meta = await getAll("meta");
		if (data.hash !== hash) {
			// @ts-ignore
			if ((data.lastModified ?? new Date(0)) > new Date(meta[0]?.lastChanged)) {
				toast.success("Server version is newer. Syncing from server...");
				await syncFromServer();
				return loadExercises();
			}
			toast.success("Local version is up to date.");
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
