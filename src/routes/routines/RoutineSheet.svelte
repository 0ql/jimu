<script lang="ts">
	import { tick, untrack } from "svelte";
	import { addRoutine, deleteRoutine, exercises, saveRoutine, type Routine } from "../idb";
	import Popup from "#lib/ui/Popup.svelte";

	/** `routine` null creates a new one. */
	let { routine, showPopup = $bindable(false) }: { routine: Routine | null; showPopup?: boolean } =
		$props();

	let name = $state(untrack(() => routine?.name ?? ""));
	// The routine's order, minus duplicates and exercises that no longer exist.
	let ids = $state<number[]>(
		untrack(() => [
			...new Set((routine?.exerciseIds ?? []).filter((id) => $exercises.some((e) => e.id === id))),
		]),
	);
	let query = $state("");
	let confirmDelete = $state(false);

	const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	const options = $derived(
		$exercises
			.filter((e) => norm(e.title).includes(norm(query.trim())))
			.sort((a, b) => a.title.localeCompare(b.title)),
	);

	const titles = $derived(new Map($exercises.map((e) => [e.id, e.title])));

	const toggle = (id: number) =>
		(ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

	const moveItem = (from: number, to: number) => {
		if (from === to || to < 0 || to >= ids.length) return;
		const next = [...ids];
		next.splice(to, 0, ...next.splice(from, 1));
		ids = next;
	};

	// Drag by the handle: the row under the finger swaps places with the dragged one.
	let dragIndex: number | null = $state(null);
	let orderList: HTMLElement | undefined = $state();

	const startDrag = (e: PointerEvent, index: number) => {
		if (e.button !== 0) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragIndex = index;
	};

	const drag = (e: PointerEvent) => {
		if (dragIndex === null || !orderList) return;
		const rows = [...orderList.children];
		const under = rows.findIndex((row) => e.clientY < row.getBoundingClientRect().bottom);
		const to = under === -1 ? rows.length - 1 : under;
		moveItem(dragIndex, to);
		dragIndex = to;
	};

	const endDrag = () => (dragIndex = null);

	const moveByKey = async (e: KeyboardEvent, index: number) => {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
		e.preventDefault();
		const to = index + (e.key === "ArrowUp" ? -1 : 1);
		moveItem(index, to);
		// Moving the row drops focus; keep it on the handle so the arrows can keep going.
		await tick();
		orderList?.children[to]?.querySelector("button")?.focus();
	};

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
				class="h-[50px] w-full rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 text-[17px] font-semibold outline-none focus:border-signal-ink placeholder:text-placeholder placeholder:font-normal"
			/>
		</div>

		{#if ids.length > 0}
			<div class="flex flex-col gap-2 min-w-0">
				<div class="flex justify-between text-xs text-subtle">
					<span id="routine-order">Order · {ids.length} exercise{ids.length === 1 ? "" : "s"}</span>
					<span
						>drag <i class="i-tabler-grip-vertical inline-block size-3 align-[-2px]"></i> to move</span
					>
				</div>
				<ol
					bind:this={orderList}
					aria-labelledby="routine-order"
					class="m-0 p-0 list-none rounded-xl border-solid border-1 border-hairline bg-bg"
				>
					{#each ids as id, i (id)}
						<li
							class="flex items-center gap-1 h-11 pr-1 border-b-solid border-b-1 border-b-divider-2 last:border-b-0 {dragIndex ===
							i
								? 'bg-raised'
								: ''}"
						>
							<button
								type="button"
								aria-label="Move {titles.get(id)}, {i + 1} of {ids.length}. Arrow keys move it."
								onpointerdown={(e) => startDrag(e, i)}
								onpointermove={drag}
								onpointerup={endDrag}
								onpointercancel={endDrag}
								onkeydown={(e) => moveByKey(e, i)}
								class="size-11 shrink-0 border-none bg-transparent flex items-center justify-center touch-none {dragIndex ===
								i
									? 'cursor-grabbing'
									: 'cursor-grab'}"
							>
								<i class="i-tabler-grip-vertical block size-[18px] text-faint"></i>
							</button>
							<span class="w-5 shrink-0 font-mono text-xs text-faint">{i + 1}</span>
							<span class="flex-1 min-w-0 truncate text-[15px]">{titles.get(id)}</span>
							<button
								type="button"
								onclick={() => toggle(id)}
								aria-label="Remove {titles.get(id)}"
								class="size-9 shrink-0 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
							>
								<i class="i-tabler-x block size-4 text-subtle"></i>
							</button>
						</li>
					{/each}
				</ol>
			</div>
		{/if}

		<fieldset class="m-0 p-0 border-none flex flex-col gap-2 min-w-0">
			<legend class="w-full p-0 mb-2 text-xs text-subtle">Add exercises</legend>
			<label
				class="flex items-center gap-2 h-10 px-3 rounded-[10px] bg-bg border-solid border-1 border-edge"
			>
				<i class="i-tabler-search block size-4 text-subtle shrink-0"></i>
				<input
					type="search"
					bind:value={query}
					aria-label="Filter exercises"
					placeholder="Filter exercises"
					autocomplete="off"
					class="flex-1 min-w-0 h-full border-none outline-none bg-transparent text-[15px] placeholder:text-dim [&::-webkit-search-cancel-button]:hidden"
				/>
			</label>
			<div
				class="max-h-[40dvh] overflow-y-auto rounded-xl border-solid border-1 border-hairline bg-bg"
			>
				{#each options as exercise (exercise.id)}
					{@const checked = ids.includes(exercise.id!)}
					<label
						class="flex items-center gap-3 min-h-11 px-3 border-b-solid border-b-1 border-b-divider-2 last:border-b-0 cursor-pointer {checked
							? 'bg-lift'
							: ''}"
					>
						<input
							type="checkbox"
							{checked}
							onchange={() => toggle(exercise.id!)}
							class="m-0 size-4 shrink-0 accent-signal-ink"
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
						: 'bg-surface-3 text-danger'}"
				>
					<i class="i-tabler-trash block size-[18px] {confirmDelete ? 'text-white' : 'text-danger'}"
					></i>
					{confirmDelete ? "Tap again to delete" : "Delete"}
				</button>
			{/if}
			<button
				type="submit"
				disabled={!name.trim()}
				class="flex-1 h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-on-signal disabled:opacity-40 disabled:cursor-default"
			>
				{routine ? "Save" : "Create routine"}
			</button>
		</div>
	</form>
</Popup>
