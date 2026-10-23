<script lang="ts">
	import { untrack } from "svelte";
	import { addRoutine, deleteRoutine, exercises, saveRoutine, type Routine } from "../idb";
	import Popup from "$lib/ui/Popup.svelte";

	/** `routine` null creates a new one. */
	let { routine, showPopup = $bindable(false) }: { routine: Routine | null; showPopup?: boolean } =
		$props();

	let name = $state(untrack(() => routine?.name ?? ""));
	let ids = $state<number[]>(untrack(() => [...(routine?.exerciseIds ?? [])]));
	let query = $state("");
	let confirmDelete = $state(false);

	const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	const options = $derived(
		$exercises
			.filter((e) => norm(e.title).includes(norm(query.trim())))
			.sort((a, b) => a.title.localeCompare(b.title)),
	);

	const toggle = (id: number) =>
		(ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

	const save = async () => {
		if (!name.trim()) return;
		if (routine) await saveRoutine({ ...routine, name: name.trim(), exerciseIds: ids });
		else await addRoutine(name.trim(), ids);
		showPopup = false;
	};

	const remove = async () => {
		if (!routine) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		await deleteRoutine(routine);
		showPopup = false;
	};
</script>

<Popup title={routine ? "Edit routine" : "New routine"} bind:showPopup>
	<form
		class="flex flex-col gap-4.5 pt-2"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<div class="flex flex-col gap-1.5">
			<label for="routine-name" class="text-xs text-subtle">Name</label>
			<input
				id="routine-name"
				bind:value={name}
				spellcheck="false"
				autocomplete="off"
				placeholder="Push day"
				class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 text-[17px] font-semibold outline-none focus:border-signal placeholder:text-[#5a5a62] placeholder:font-normal"
			/>
		</div>

		<fieldset class="m-0 p-0 border-none flex flex-col gap-2 min-w-0">
			<legend class="w-full p-0 mb-2 flex justify-between text-xs text-subtle">
				<span>Exercises</span>
				<span class="font-mono">{ids.length} selected</span>
			</legend>
			<label
				class="flex items-center gap-2 h-10 px-3 rounded-[10px] bg-bg border-solid border-1 border-[#2e2e34]"
			>
				<i class="i-tabler-search block size-4 text-subtle shrink-0"></i>
				<input
					type="search"
					bind:value={query}
					aria-label="Filter exercises"
					placeholder="Filter exercises"
					autocomplete="off"
					class="flex-1 min-w-0 h-full border-none outline-none bg-transparent text-[15px] placeholder:text-[#7c7c85] [&::-webkit-search-cancel-button]:hidden"
				/>
			</label>
			<div
				class="max-h-[40dvh] overflow-y-auto rounded-xl border-solid border-1 border-hairline bg-bg"
			>
				{#each options as exercise (exercise.id)}
					{@const checked = ids.includes(exercise.id!)}
					<label
						class="flex items-center gap-3 min-h-11 px-3 border-b-solid border-b-1 border-b-[#1f1f23] last:border-b-0 cursor-pointer {checked
							? 'bg-[#1b1b1f]'
							: ''}"
					>
						<input
							type="checkbox"
							{checked}
							onchange={() => toggle(exercise.id!)}
							class="m-0 size-4 shrink-0 accent-[#d7f55a]"
						/>
						<span class="flex-1 min-w-0 truncate text-[15px] {checked ? 'font-semibold' : ''}"
							>{exercise.title}</span
						>
					</label>
				{:else}
					<p class="px-3 py-4 text-sm text-subtle">No exercise matches “{query.trim()}”</p>
				{/each}
			</div>
		</fieldset>

		<div class="flex gap-2">
			{#if routine}
				<button
					type="button"
					onclick={remove}
					class="h-12 px-4 rounded-xl border-none cursor-pointer flex items-center gap-2 text-[15px] {confirmDelete
						? 'bg-destructive text-white'
						: 'bg-surface-3 text-[#ff8a8a]'}"
				>
					<i
						class="i-tabler-trash block size-[18px] {confirmDelete
							? 'text-white'
							: 'text-[#ff8a8a]'}"
					></i>
					{confirmDelete ? "Tap again to delete" : "Delete"}
				</button>
			{/if}
			<button
				type="submit"
				disabled={!name.trim()}
				class="flex-1 h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-[#111] disabled:opacity-40 disabled:cursor-default"
			>
				{routine ? "Save" : "Create routine"}
			</button>
		</div>
	</form>
</Popup>
