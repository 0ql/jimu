<script lang="ts">
	import { deleteExercise, type Exercise, saveExercise } from "./idb";

	import Btn from "$lib/ui/Button.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import Card from "$lib/ui/Card.svelte";

	let { exercise }: { exercise: Exercise } = $props();
	let showPopup = $state(false);
	let exerciseCopy = $state(exercise);
</script>

<Card cl="mt-4">
	<h2 class="text-base font-bold my-1 flex gap-2 items-center justify-between">
		<input
			spellcheck="false"
			bind:value={exerciseCopy.title}
			onchange={() => saveExercise(exerciseCopy)}
			class="bg-transparent w-full text-current border-none text-lg font-semibold outline-none"
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
			onchange={() => saveExercise(exerciseCopy)}
			bind:value={exerciseCopy.workoutsString}
		></textarea>
	</details>
	<Popup title="Edit Exercise" bind:showPopup>
		<Btn
			onclick={() => deleteExercise(exerciseCopy)}
			cl="bg-destructive cursor-pointer">Delete Exercise</Btn
		>
	</Popup>
</Card>
