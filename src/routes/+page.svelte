<script lang="ts">
	import { onMount } from "svelte";
	import {
		type DB,
		type Routine,
		exercises,
		routines,
		getAll,
		loadDB,
		loadExercises,
		loadRoutines,
		synced,
		addExercise,
		syncToServer,
		syncRoutinesToServer,
		getRoutineMetaTimestamp,
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

	const syncFromServer = async () => {
		const res = await fetch("/");
		const jsn = await res.json();
		await db.clear("exercises");
		for (const exercise of jsn) {
			await db.add("exercises", {
				id: exercise.id,
				title: exercise.title,
				workoutsString: exercise.workoutsString,
			});
		}
		await db.put("meta", { id: 1, lastChanged: Date.now() });
		synced.set(true);
		await loadExercises();
	};

	const syncRoutinesFromServer = async () => {
		const res = await fetch("/routines");
		const jsn: Routine[] = await res.json();
		await db.clear("routines");
		for (const routine of jsn) {
			await db.add("routines", {
				id: routine.id,
				name: routine.name,
				exerciseIds: routine.exerciseIds,
			});
		}
		await db.put("meta", { id: 2, lastChanged: Date.now() });
		await loadRoutines();
	};

	onMount(async () => {
		db = await loadDB();
		await loadExercises();
		await loadRoutines();

		const meta = await getAll("meta");
		const localTs = meta[0]?.lastChanged ?? 0;
		const serverTs = data.lastModified?.getTime() ?? 0;
		console.log(
			"local:",
			new Date(localTs).toLocaleString(),
			"server:",
			new Date(serverTs).toLocaleString(),
		);

		if ($exercises.length === 0 && serverTs === 0) {
			toast.success("No Exercises stored locally and none on server");
		} else if ($exercises.length === 0) {
			toast.success("No Exercises found locally. But Server has Exercises. Syncing from server...");
			await syncFromServer();
		} else if (serverTs > localTs) {
			toast.success("Server version is newer. Syncing from server...");
			await syncFromServer();
		} else if (localTs > serverTs) {
			await syncToServer();
		}

		const localRoutineTs = await getRoutineMetaTimestamp();
		const serverRoutineTs = data.routineLastModified?.getTime() ?? 0;

		if (serverRoutineTs > localRoutineTs) {
			await syncRoutinesFromServer();
		} else if (localRoutineTs > serverRoutineTs) {
			await syncRoutinesToServer();
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
