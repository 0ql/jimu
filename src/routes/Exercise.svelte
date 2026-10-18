<script lang="ts">
	import { untrack } from "svelte";
	import { deleteExercise, type Exercise, loadExercises, saveExercise } from "./idb";

	import Btn from "$lib/ui/Button.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import Card from "$lib/ui/Card.svelte";

	let { exercise }: { exercise: Exercise } = $props();
	let showPopup = $state(false);

	let title = $state(untrack(() => exercise.title));
	let workoutsString = $state(untrack(() => exercise.workoutsString));
	let expanded = $state(false);

	const save = () => saveExercise({ ...exercise, title, workoutsString });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<Card>
	<div
		onclick={() => (expanded = !expanded)}
		class="cursor-pointer flex items-center justify-between"
	>
		<p class="text-lg font-semibold m-0">{title}</p>
		<button
			onclick={(e) => {
				e.stopPropagation();
				showPopup = !showPopup;
			}}
			aria-label="Edit exercise"
			class="i-heroicons-ellipsis-vertical-16-solid size-5 block shrink-0"
		></button>
	</div>
	{#if expanded}
		<textarea
			spellcheck="false"
			class="w-full bg-transparent text-foreground border-none outline-none text-1rem mt-2"
			onchange={save}
			bind:value={workoutsString}
		></textarea>
	{/if}
	<Popup title="Edit Exercise" bind:showPopup>
		<input
			spellcheck="false"
			bind:value={title}
			onchange={save}
			class="bg-transparent w-full text-current border-solid border-1 border-border-input rounded-lg text-lg font-semibold outline-none px-3 py-2 mt-2"
		/>
		<Btn
			onclick={() => {
				deleteExercise(exercise);
				loadExercises();
			}}
			cl="bg-destructive cursor-pointer mt-3"
		>
			Delete Exercise
		</Btn>
	</Popup>
</Card>
