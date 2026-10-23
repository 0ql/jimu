<script lang="ts">
	import { onMount, tick } from "svelte";
	import { page } from "$app/state";
	import {
		type DB,
		type Routine,
		exercises,
		routines,
		loadDB,
		loadExercises,
		loadRoutines,
		synced,
		addExercise,
		syncToServer,
		syncRoutinesToServer,
		getSyncMeta,
		markSynced,
		planSync,
		EXERCISES_META,
		ROUTINES_META,
		saveRoutine,
	} from "./idb";
	import { dateStamp, daysAgo, formatKg, isTodayLine, lineStats, parseLog } from "$lib/sets";
	import type { IDBPDatabase } from "idb";
	import type { PageProps } from "./$types";

	import ExerciseComponent from "./Exercise.svelte";
	import ExerciseDetail from "./ExerciseDetail.svelte";
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
	// Rows copy their exercise into local state, so remount them after a pull from the server.
	let pullCount = $state(0);
	// Empty states wait for IndexedDB so they don't flash on every visit.
	let loaded = $state(false);

	const syncFromServer = async () => {
		const res = await fetch("/");
		const jsn = await res.json();
		await db.clear("exercises");
		for (const exercise of jsn) {
			await db.add("exercises", {
				id: exercise.id,
				title: exercise.title,
				workoutsString: exercise.workoutsString,
				note: exercise.note,
			});
		}
		await markSynced(EXERCISES_META, data.lastModified?.getTime() ?? 0);
		synced.set(true);
		await loadExercises();
		pullCount++;
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
		await markSynced(ROUTINES_META, data.routineLastModified?.getTime() ?? 0);
		await loadRoutines();
	};

	onMount(async () => {
		db = await loadDB();
		await loadExercises();
		await loadRoutines();

		// "Train" on the routines page links here with ?routine=<id>.
		const routineParam = Number(page.url.searchParams.get("routine"));
		if (routineParam && $routines.some((r) => r.id === routineParam)) {
			selectedRoutineId = routineParam;
		}

		// Sessions link here with ?exercise=<id>: select it on desktop, open it on phones.
		const exerciseParam = Number(page.url.searchParams.get("exercise"));
		if (exerciseParam && $exercises.some((e) => e.id === exerciseParam)) {
			selectedId = exerciseParam;
			openId = exerciseParam;
			await tick();
			if (!wide)
				document.getElementById(`log-${exerciseParam}`)?.scrollIntoView({ block: "center" });
		}

		const serverTs = data.lastModified?.getTime() ?? 0;
		const plan = planSync(await getSyncMeta(EXERCISES_META), serverTs);

		if ($exercises.length === 0 && serverTs === 0) {
			toast.success("No Exercises stored locally and none on server");
		} else if ($exercises.length === 0 && plan !== "push") {
			toast.success("No Exercises found locally. But Server has Exercises. Syncing from server...");
			await syncFromServer();
		} else if (plan === "pull") {
			toast.success("Changes from another device. Syncing from server...");
			await syncFromServer();
		} else if (plan === "conflict") {
			toast.error("Changed here and on another device. Keeping this device's version.");
			synced.set(false);
			await syncToServer();
		} else if (plan === "push") {
			synced.set(false);
			await syncToServer();
		} else {
			await markSynced(EXERCISES_META, serverTs);
		}

		// After a possible first pull, so a new device doesn't claim to have no exercises.
		loaded = true;

		const routineServerTs = data.routineLastModified?.getTime() ?? 0;
		const routinePlan = planSync(await getSyncMeta(ROUTINES_META), routineServerTs);
		if (routinePlan === "pull") await syncRoutinesFromServer();
		else if (routinePlan === "push" || routinePlan === "conflict") await syncRoutinesToServer();
		else if (routineServerTs) await markSynced(ROUTINES_META, routineServerTs);
	});

	const activeRoutine = $derived(
		selectedRoutineId !== null ? ($routines.find((r) => r.id === selectedRoutineId) ?? null) : null,
	);

	const visibleExercises = $derived(
		$exercises
			.filter((exercise) => {
				const inRoutine =
					activeRoutine === null || activeRoutine.exerciseIds.includes(exercise.id!);
				const matchesSearch = exercise.title
					.toLowerCase()
					.normalize("NFD")
					.replace(/[̀-ͯ]/g, "")
					.includes(searchString.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
				return inRoutine && matchesSearch;
			})
			.sort((a, b) => a.title.localeCompare(b.title)),
	);

	let openId: number | null = $state(null);

	// Wide screens get the two-pane layout: list on the left, the selected exercise on the right.
	let wide = $state(false);
	$effect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		wide = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (wide = e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	});

	let selectedId: number | null = $state(null);
	const selected = $derived(
		visibleExercises.find((e) => e.id === selectedId) ?? visibleExercises[0] ?? null,
	);
	let searchInput: HTMLInputElement | undefined = $state();
	let detail: ReturnType<typeof ExerciseDetail> | undefined = $state();
	let listEl: HTMLElement | undefined = $state();

	const select = async (id: number | undefined) => {
		if (id === undefined) return;
		selectedId = id;
		await tick();
		listEl?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
	};

	const move = (step: number) => {
		if (!visibleExercises.length) return;
		const i = visibleExercises.findIndex((e) => e.id === selected?.id);
		const next = Math.min(visibleExercises.length - 1, Math.max(0, i + step));
		select(visibleExercises[next].id);
	};

	const backToList = () => {
		(listEl?.querySelector(`[data-id="${selected?.id}"]`) as HTMLElement | null)?.focus();
	};

	const onSearchKey = (e: KeyboardEvent) => {
		if (!wide) return;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			move(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (selected) detail?.focusLog();
			else if (searchString.trim()) createFromSearch();
		} else if (e.key === "Escape") {
			searchString = "";
		}
	};

	/** Desktop shortcuts: / search, ↑↓ switch exercise, Enter edit log. */
	const onWindowKey = (e: KeyboardEvent) => {
		if (!wide || showAddPopup || e.defaultPrevented) return;
		const target = e.target as HTMLElement;
		if (target.closest("input, textarea, select, [role=dialog], section.fixed")) return;
		const inList = !!target.closest("[data-id]");
		if (e.key === "/") {
			e.preventDefault();
			searchInput?.focus();
		} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			if (target.closest("button, a") && !inList) return;
			e.preventDefault();
			move(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Enter" && (inList || !target.closest("button, a"))) {
			e.preventDefault();
			detail?.focusLog();
		}
	};

	const today = $derived.by(() => {
		const names: string[] = [];
		let volume = 0;
		for (const exercise of $exercises) {
			const { current } = parseLog(exercise.workoutsString);
			if (!isTodayLine(current) || current.sets.length === 0) continue;
			names.push(exercise.title);
			volume += lineStats(current.sets).volume;
		}
		return { names, volume };
	});

	const create = async (title: string, workoutsString = "") => {
		if (!title.trim()) return;
		const id = await addExercise(title.trim(), workoutsString);
		if (selectedRoutineId !== null && activeRoutine) {
			await saveRoutine({ ...activeRoutine, exerciseIds: [...activeRoutine.exerciseIds, id] });
		}
		newTitle = "";
		showAddPopup = false;
		openId = id;
		if (wide) {
			searchString = "";
			await select(id);
			detail?.focusLog();
		}
	};

	const createFromSearch = () => create(searchString, `${dateStamp()} `);
</script>

<svelte:window onkeydown={onWindowKey} />

{#snippet todayCard()}
	{#if today.names.length > 0}
		<section
			class="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-surface border-solid border-1 border-hairline"
		>
			<span class="size-2 rounded-full bg-signal shrink-0"></span>
			<div class="flex-1 min-w-0 flex flex-col gap-0.5">
				<span class="text-xs text-subtle">
					Today · {today.names.length} exercise{today.names.length === 1 ? "" : "s"}
				</span>
				<span class="text-sm truncate">{today.names.join(", ")}</span>
			</div>
			<span class="font-display font-semibold text-[18px] whitespace-nowrap">
				{formatKg(today.volume)} kg
			</span>
		</section>
	{/if}
{/snippet}

{#snippet createButton()}
	<button
		onclick={createFromSearch}
		class="h-12 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-[#111]"
	>
		<i class="i-tabler-plus block size-[18px] text-[#111]"></i>
		Create “{searchString.trim()}”
	</button>
{/snippet}

{#snippet routineChips(wrap: boolean)}
	{#if $routines.length > 0}
		<div
			class="flex gap-1.5 {wrap
				? 'flex-wrap'
				: 'overflow-x-auto -mx-4 px-4 [scrollbar-width:none]'}"
		>
			{#each [{ id: null, name: "All" }, ...$routines] as routine (routine.id)}
				{@const active = selectedRoutineId === routine.id}
				<button
					onclick={() => (selectedRoutineId = routine.id ?? null)}
					aria-pressed={active}
					class="{wrap
						? 'h-[30px] px-3 text-[13px]'
						: 'h-[34px] px-3.5 text-sm'} rounded-full font-semibold whitespace-nowrap border-solid border-1 cursor-pointer transition-colors
						{active ? 'bg-dark text-bg border-dark' : 'bg-transparent border-[#2e2e34] text-[#c9c9cf]'}"
				>
					{routine.name}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#if wide}
	<main
		class="max-w-[1408px] mx-auto px-4 flex gap-6 items-start"
		style="padding-top: calc(var(--nav-h, 5rem) + 1.5rem); padding-bottom: 2rem"
	>
		<aside
			aria-label="Exercises"
			class="w-[340px] xl:w-[380px] shrink-0 sticky flex flex-col gap-3"
			style="top: calc(var(--nav-h, 5rem) + 1.5rem); max-height: calc(100dvh - var(--nav-h, 5rem) - 3rem)"
		>
			<SearchBar
				bind:value={searchString}
				bind:input={searchInput}
				hint="/"
				onkeydown={onSearchKey}
			/>
			{@render routineChips(true)}
			{@render todayCard()}

			{#if visibleExercises.length > 0}
				<div
					bind:this={listEl}
					class="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-surface border-solid border-1 border-hairline"
				>
					{#each visibleExercises as exercise (exercise.id)}
						{@const current = parseLog(exercise.workoutsString).current}
						{@const isSelected = exercise.id === selected?.id}
						<button
							data-id={exercise.id}
							onclick={() => select(exercise.id)}
							aria-current={isSelected ? "true" : undefined}
							class="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none border-b-solid border-b-1 border-b-[#1f1f23] last:border-b-0 text-left cursor-pointer {isSelected
								? 'bg-[#26262c]'
								: 'bg-transparent hover:bg-[#1c1c20]'}"
						>
							<span
								class="size-[7px] rounded-full shrink-0 {isTodayLine(current) && current.sets.length
									? 'bg-signal'
									: 'bg-[#2e2e34]'}"
							></span>
							<span class="flex-1 min-w-0 flex flex-col gap-0.5">
								<span
									class="text-[15px] font-semibold truncate {isSelected
										? 'text-white'
										: 'text-[#e2e2e6]'}">{exercise.title}</span
								>
								<span class="font-mono text-xs text-subtle truncate">
									{#if current.date}<span class="text-faint">{current.date}</span
										>&ensp;{/if}{current.rest || "No sets yet"}
								</span>
							</span>
							<span class="text-xs text-[#7c7c85] whitespace-nowrap"
								>{daysAgo(current.date, current.year)}</span
							>
						</button>
					{/each}
				</div>
			{:else if searchString.trim()}
				<div class="flex flex-col items-start gap-3 py-6 px-1">
					<p class="text-subtle text-sm">No exercise matches “{searchString.trim()}”</p>
					{@render createButton()}
				</div>
			{/if}

			<p class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#7c7c85] px-1">
				<span><kbd>/</kbd> search</span>
				<span><kbd>↑</kbd> <kbd>↓</kbd> switch</span>
				<span><kbd>Enter</kbd> edit log</span>
				<span><kbd>Esc</kbd> back to list</span>
			</p>
		</aside>

		<section class="flex-1 min-w-0" aria-label="Selected exercise">
			{#if selected}
				{#key `${selected.id}:${pullCount}`}
					<ExerciseDetail bind:this={detail} exercise={selected} onescape={backToList} />
				{/key}
			{:else if loaded && $exercises.length === 0}
				<p class="text-subtle py-16 text-center">
					No exercises yet. Add your first one with New exercise.
				</p>
			{/if}
		</section>
	</main>
{:else}
	<main
		class="flex flex-col gap-3"
		style="padding-top: calc(var(--nav-h, 11rem) + 0.75rem); padding-bottom: calc(var(--pad-h, 0px) + 2.5rem)"
	>
		{@render todayCard()}

		{#if visibleExercises.length > 0}
			<div class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden">
				{#each visibleExercises as exercise (`${exercise.id}:${pullCount}`)}
					<ExerciseComponent
						{exercise}
						open={openId === exercise.id}
						ontoggle={() => (openId = openId === exercise.id ? null : exercise.id!)}
					/>
				{/each}
			</div>
		{:else if searchString.trim()}
			<div class="flex flex-col items-center gap-3.5 py-8 px-2 text-center">
				<p class="text-subtle text-[15px]">No exercise matches “{searchString.trim()}”</p>
				{@render createButton()}
			</div>
		{:else if loaded && $exercises.length === 0}
			<p class="text-subtle text-center py-8">No exercises yet. Tap + to add your first one.</p>
		{/if}
	</main>
{/if}

<Popup title="New Exercise" bind:showPopup={showAddPopup}>
	<Input
		placeholder="Exercise name"
		bind:value={newTitle}
		cl="text-xl"
		onkeydown={(e: KeyboardEvent) => e.key === "Enter" && create(newTitle)}
	/>
	<Btn cl="cursor-pointer mt-3" onclick={() => create(newTitle)}>Add</Btn>
</Popup>

<Nav onadd={() => (showAddPopup = true)}>
	{#if !wide}
		<div class="flex gap-2">
			<div class="flex-1 min-w-0">
				<SearchBar bind:value={searchString} />
			</div>
			<button
				onclick={() => (showAddPopup = true)}
				aria-label="New exercise"
				class="size-12 shrink-0 rounded-xl border-none bg-signal cursor-pointer flex items-center justify-center"
			>
				<i class="i-tabler-plus block size-[22px] text-[#111]"></i>
			</button>
		</div>
		{@render routineChips(false)}
	{/if}
</Nav>
