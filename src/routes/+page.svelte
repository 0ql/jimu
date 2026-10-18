<script lang="ts">
	import { onMount } from "svelte";
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
	import { dateStamp, formatKg, lineStats, parseLog } from "$lib/sets";
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
	// Rows copy their exercise into local state, so remount them after a pull from the server.
	let pullCount = $state(0);

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

	const today = $derived.by(() => {
		const stamp = dateStamp();
		const names: string[] = [];
		let volume = 0;
		for (const exercise of $exercises) {
			const { current } = parseLog(exercise.workoutsString);
			if (current.date !== stamp || current.sets.length === 0) continue;
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
	};

	const createFromSearch = () => create(searchString, `${dateStamp()} `);
</script>

<main
	class="flex flex-col gap-3"
	style="padding-top: calc(var(--nav-h, 11rem) + 0.75rem); padding-bottom: calc(var(--pad-h, 0px) + 2.5rem)"
>
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
			<span class="font-cond font-semibold text-[22px] whitespace-nowrap">
				{formatKg(today.volume)} kg
			</span>
		</section>
	{/if}

	{#if visibleExercises.length > 0}
		<div
			class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden lg:max-w-3xl"
		>
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
			<button
				onclick={createFromSearch}
				class="h-12 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-[#111]"
			>
				<i class="i-tabler-plus block size-[18px] text-[#111]"></i>
				Create “{searchString.trim()}”
			</button>
		</div>
	{:else if $exercises.length === 0}
		<p class="text-subtle text-center py-8">No exercises yet. Tap + to add your first one.</p>
	{/if}
</main>

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
	<SearchBar bind:value={searchString} />
	{#if $routines.length > 0}
		<div class="flex gap-1.5 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]">
			{#each [{ id: null, name: "All" }, ...$routines] as routine (routine.id)}
				{@const active = selectedRoutineId === routine.id}
				<button
					onclick={() => (selectedRoutineId = routine.id ?? null)}
					aria-pressed={active}
					class="h-[34px] px-3.5 rounded-full text-sm font-semibold whitespace-nowrap border-solid border-1 cursor-pointer transition-colors
						{active ? 'bg-dark text-bg border-dark' : 'bg-transparent border-[#2e2e34] text-[#c9c9cf]'}"
				>
					{routine.name}
				</button>
			{/each}
		</div>
	{/if}
</Nav>
