<script lang="ts">
	import { onMount } from "svelte";
	import {
		exercises,
		loadExercises,
		loadRoutines,
		routines,
		addRoutine,
		saveRoutine,
		deleteRoutine,
		type Routine,
	} from "../idb";
	import Nav from "../Nav.svelte";
	import Card from "$lib/ui/Card.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import Input from "$lib/ui/Input.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import Checkbox from "$lib/ui/Checkbox.svelte";

	onMount(async () => {
		await loadExercises();
		await loadRoutines();
	});

	let showCreatePopup = $state(false);
	let showEditPopup = $state(false);
	let newRoutineName = $state("");
	let editingRoutine: Routine | null = $state(null);
	let selectedExerciseIds = $state<number[]>([]);

	const openCreate = () => {
		newRoutineName = "";
		selectedExerciseIds = [];
		showCreatePopup = true;
	};

	const openEdit = (routine: Routine) => {
		editingRoutine = { ...routine, exerciseIds: [...routine.exerciseIds] };
		selectedExerciseIds = [...routine.exerciseIds];
		showEditPopup = true;
	};

	const toggleExercise = (id: number) => {
		if (selectedExerciseIds.includes(id)) {
			selectedExerciseIds = selectedExerciseIds.filter((e) => e !== id);
		} else {
			selectedExerciseIds = [...selectedExerciseIds, id];
		}
	};

	const create = async () => {
		if (!newRoutineName.trim()) return;
		await addRoutine(newRoutineName.trim(), selectedExerciseIds);
		showCreatePopup = false;
	};

	const save = async () => {
		if (!editingRoutine) return;
		await saveRoutine({ ...editingRoutine, exerciseIds: selectedExerciseIds });
		showEditPopup = false;
	};
</script>

<main class="px-4 pt-24 pb-8 max-w-5xl mx-auto">
	<PageTitle cl="mb-4">Routines</PageTitle>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each $routines as routine}
			<Card>
				<div class="flex justify-between items-start">
					<div>
						<p class="font-semibold text-lg m-0">{routine.name}</p>
						<p class="text-xs text-fg-alt mt-1 m-0">
							{routine.exerciseIds.length} exercise{routine.exerciseIds.length !== 1 ? "s" : ""}
						</p>
					</div>
					<button
						onclick={() => deleteRoutine(routine)}
						class="border-none bg-transparent cursor-pointer"
					>
						<i class="block i-tabler-trash size-5 bg-destructive"></i>
					</button>
				</div>
				<Btn onclick={() => openEdit(routine)} cl="cursor-pointer mt-3">Edit</Btn>
			</Card>
		{/each}
	</div>
</main>

<Popup title="New Routine" bind:showPopup={showCreatePopup}>
	<Input placeholder="Routine name" bind:value={newRoutineName} cl="mt-2" />
	<p class="text-xs uppercase tracking-widest text-fg-alt mt-4 mb-2 m-0">Exercises</p>
	<div class="flex flex-col gap-2 overflow-y-auto max-h-48">
		{#each $exercises as exercise}
			<Checkbox
				label={exercise.title}
				checked={selectedExerciseIds.includes(exercise.id!)}
				onchange={() => toggleExercise(exercise.id!)}
			/>
		{/each}
	</div>
	<Btn onclick={create} cl="cursor-pointer mt-3">Create</Btn>
</Popup>

<Popup title="Edit Routine" bind:showPopup={showEditPopup}>
	<p class="text-xs uppercase tracking-widest text-fg-alt mt-2 mb-2 m-0">Exercises</p>
	<div class="flex flex-col gap-2 overflow-y-auto max-h-48">
		{#each $exercises as exercise}
			<Checkbox
				label={exercise.title}
				checked={selectedExerciseIds.includes(exercise.id!)}
				onchange={() => toggleExercise(exercise.id!)}
			/>
		{/each}
	</div>
	<Btn onclick={save} cl="cursor-pointer mt-3">Save</Btn>
</Popup>

<Nav onadd={openCreate} />
