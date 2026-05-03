<script lang="ts">
	import { onMount } from "svelte";
	import {
		type DB,
		type Exercise,
		exercises,
		routines,
		getAll,
		loadDB,
		loadExercises,
		loadRoutines,
		synced,
		addExercise,
	} from "./idb";
	import type { IDBPDatabase } from "idb";
	import type { PageProps } from "./$types";

	import ExerciseComponent from "./Exercise.svelte";
	import Nav from "./Nav.svelte";
	import SearchBar from "./SearchBar.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import { toast } from "$lib/toast.svelte";
	import Input from "$lib/ui/Input.svelte";
	import Btn from "$lib/ui/Button.svelte";

	let searchString: string = $state("");
	let db: IDBPDatabase<DB>;
	let { data }: PageProps = $props();
	let showAddPopup = $state(false);
	let newTitle = $state("");
	let selectedRoutineId: number | null = $state(null);

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
		await db.put("meta", { id: 1, lastChanged: Date.now() });
		synced.set(true);
		loadExercises();
	};

	onMount(async () => {
		db = await loadDB();
		await loadExercises();
		await loadRoutines();
		if ($exercises.length === 0 && !data.hash) {
			toast.success("No Exercises stored locally and none on server");
			return;
		}
		if ($exercises.length === 0) {
			toast.success("No Exercises found locally. But Server has Exercises. Syncing from server...");
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
		}
	});

	const activeRoutine = $derived(
		selectedRoutineId !== null ? ($routines.find((r) => r.id === selectedRoutineId) ?? null) : null,
	);

	const visibleExercises = $derived(
		$exercises.filter((exercise) => {
			const inRoutine = activeRoutine === null || activeRoutine.exerciseIds.includes(exercise.id!);
			const matchesSearch = exercise.title
				.toLowerCase()
				.normalize("NFD")
				.replace(/[̀-ͯ]/g, "")
				.includes(searchString.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
			return inRoutine && matchesSearch;
		}),
	);
</script>

<main class="mt-42 pb-8">
	{#if $routines.length > 0}
		<div class="flex gap-2 mb-4 flex-wrap">
			<button
				onclick={() => (selectedRoutineId = null)}
				class="px-3 py-1 rounded-full text-sm font-semibold border-solid border-1 cursor-pointer transition-colors
					{selectedRoutineId === null
					? 'bg-dark text-bg border-dark'
					: 'bg-transparent border-muted text-fg-alt'}"
			>
				All
			</button>
			{#each $routines as routine}
				<button
					onclick={() => (selectedRoutineId = routine.id!)}
					class="px-3 py-1 rounded-full text-sm font-semibold border-solid border-1 cursor-pointer transition-colors
						{selectedRoutineId === routine.id
						? 'bg-dark text-bg border-dark'
						: 'bg-transparent border-muted text-fg-alt'}"
				>
					{routine.name}
				</button>
			{/each}
		</div>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each visibleExercises as exercise}
			<ExerciseComponent {exercise} />
		{/each}
	</div>
</main>

<Popup title="New Exercise" bind:showPopup={showAddPopup}>
	<Input
		placeholder="Exercise name"
		bind:value={newTitle}
		cl="text-xl"
		onkeydown={(e) =>
			e.key === "Enter" &&
			newTitle.trim() &&
			(addExercise(newTitle.trim()), (newTitle = ""), (showAddPopup = false))}
	/>
	<Btn
		cl="cursor-pointer mt-3"
		onclick={() => {
			if (!newTitle.trim()) return;
			addExercise(newTitle.trim());
			newTitle = "";
			showAddPopup = false;
		}}
	>
		Add
	</Btn>
</Popup>

<Nav onadd={() => (showAddPopup = true)}>
	<SearchBar bind:value={searchString} />
</Nav>
