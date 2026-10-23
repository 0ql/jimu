<script lang="ts">
	import {
		deleteExercise,
		type Exercise,
		loadExercises,
		routines,
		saveRoutine,
		type Routine,
	} from "./idb";
	import type { LogEditor } from "./logEditor.svelte";
	import Popup from "$lib/ui/Popup.svelte";

	let {
		exercise,
		editor,
		showPopup = $bindable(false),
	}: { exercise: Exercise; editor: LogEditor; showPopup?: boolean } = $props();

	let confirmDelete = $state(false);
	$effect(() => {
		if (!showPopup) confirmDelete = false;
	});

	const inRoutine = (routine: Routine) => routine.exerciseIds.includes(exercise.id!);
	const toggleRoutine = (routine: Routine) =>
		saveRoutine({
			...routine,
			exerciseIds: inRoutine(routine)
				? routine.exerciseIds.filter((id) => id !== exercise.id)
				: [...routine.exerciseIds, exercise.id!],
		});

	const remove = async () => {
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		showPopup = false;
		await deleteExercise(exercise);
		await loadExercises();
	};
</script>

<Popup title="Edit exercise" bind:showPopup>
	<div class="flex flex-col gap-4.5 pt-2">
		<div class="flex flex-col gap-1.5">
			<label for="name-{exercise.id}" class="text-xs text-subtle">Name</label>
			<input
				id="name-{exercise.id}"
				spellcheck="false"
				bind:value={editor.title}
				onchange={editor.save}
				class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 text-[17px] font-semibold outline-none focus:border-signal"
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="note-{exercise.id}" class="text-xs text-subtle">Machine setup</label>
			<input
				id="note-{exercise.id}"
				spellcheck="false"
				autocomplete="off"
				bind:value={editor.note}
				onchange={editor.save}
				placeholder="Sitz 3, Rolle 2"
				class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 font-mono text-[15px] outline-none focus:border-signal placeholder:text-[#5a5a62]"
			/>
		</div>

		{#if $routines.length > 0}
			<fieldset class="m-0 p-0 border-none flex flex-col gap-2">
				<legend class="text-xs text-subtle p-0 mb-2">In routines</legend>
				<div class="flex flex-wrap gap-1.5">
					{#each $routines as routine (routine.id)}
						{@const checked = inRoutine(routine)}
						<label
							class="h-10 pl-2.5 pr-3.5 rounded-full flex items-center gap-2 text-sm font-semibold cursor-pointer border-solid border-1
								{checked ? 'bg-dark border-dark text-bg' : 'border-[#2e2e34] text-[#c9c9cf]'}"
						>
							<input
								type="checkbox"
								{checked}
								onchange={() => toggleRoutine(routine)}
								class="m-0 size-4 accent-[#111]"
							/>
							{routine.name}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="flex flex-col rounded-2xl border-solid border-1 border-hairline overflow-hidden">
			<a
				href="/analytics?exercise={exercise.id}"
				class="flex items-center gap-3 min-h-13 px-3.5 no-underline border-b-solid border-b-1 border-b-[#222227]"
			>
				<i class="i-tabler-chart-bar block size-5"></i>
				<span class="flex-1">Progress chart</span>
				<span class="font-mono text-xs text-subtle">
					{editor.sessionCount} session{editor.sessionCount === 1 ? "" : "s"}
				</span>
			</a>
			<button
				onclick={remove}
				class="flex items-center gap-3 min-h-13 px-3.5 border-none bg-transparent cursor-pointer text-left text-base {confirmDelete
					? 'bg-destructive text-white'
					: 'text-[#ff8a8a]'}"
			>
				<i class="i-tabler-trash block size-5 {confirmDelete ? 'text-white' : 'text-[#ff8a8a]'}"
				></i>
				{confirmDelete ? "Tap again to delete" : "Delete exercise…"}
			</button>
		</div>

		<button
			onclick={() => (showPopup = false)}
			class="h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-[#111]"
		>
			Done
		</button>
	</div>
</Popup>
