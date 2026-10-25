<script lang="ts">
	import { onMount } from "svelte";
	import {
		exercises,
		loadExercises,
		loadRoutines,
		loadSplits,
		routines,
		splits,
		type Routine,
		type Split,
	} from "../idb";
	import { daysSince, isTodayLine, formatWeight, lineStats, parseLog } from "#lib/sets.js";
	import { isoDate, members, splitStatus, trainedDates } from "#lib/splits.js";
	import { routineBadges } from "#lib/routineBadges.js";
	import Nav from "../Nav.svelte";
	import Popup from "#lib/ui/Popup.svelte";
	import RoutineChip from "#lib/ui/RoutineChip.svelte";
	import RoutineSheet from "./RoutineSheet.svelte";
	import SplitCard from "./SplitCard.svelte";
	import SplitSheet from "./SplitSheet.svelte";

	onMount(async () => {
		await loadExercises();
		await loadRoutines();
		await loadSplits();
		loaded = true;
	});

	// Avoid flashing the empty state before IndexedDB has loaded.
	let loaded = $state(false);

	let sheetOpen = $state(false);
	let sheetRoutine: Routine | null = $state(null);
	let sheetKey = $state(0);

	const openSheet = (routine: Routine | null) => {
		sheetRoutine = routine;
		sheetKey++;
		sheetOpen = true;
	};

	let splitOpen = $state(false);
	let splitEditing: Split | null = $state(null);
	let splitKey = $state(0);

	const openSplit = (split: Split | null) => {
		splitEditing = split;
		splitKey++;
		splitOpen = true;
	};

	/** Phones choose between a split and a routine in a sheet; desktop in the New menu. */
	let chooserOpen = $state(false);

	const today = isoDate();
	const badges = $derived(routineBadges($routines));
	const routinesById = $derived(new Map($routines.map((r) => [r.id!, r])));
	const trained = $derived(trainedDates({ routines: $routines, exercises: $exercises }));
	const splitCards = $derived(
		$splits.map((split) => ({ split, status: splitStatus(split, trained, today, 14) })),
	);
	/** The splits each routine is in, by name. */
	const splitNames = $derived.by(() => {
		const names = new Map<number, string[]>();
		for (const split of $splits) {
			for (const id of members(split)) names.set(id, [...(names.get(id) ?? []), split.name]);
		}
		return names;
	});

	const MAX_LISTED = 6;
	const sectionHead = "m-0 text-[11px] tracking-[0.08em] uppercase font-semibold text-subtle";
	const newOption =
		"w-full flex items-start gap-3 p-3 rounded-xl border-none bg-transparent hover:bg-lift cursor-pointer text-left disabled:opacity-45 disabled:cursor-default";

	const cards = $derived.by(() => {
		const byId = new Map($exercises.map((e) => [e.id, e]));
		return $routines.map((routine) => {
			const items = [...new Set(routine.exerciseIds)]
				.map((id) => byId.get(id))
				.filter((e) => e !== undefined)
				.map((e) => {
					const { current } = parseLog(e.workoutsString);
					const top = lineStats(current.sets).top;
					return {
						id: e.id!,
						title: e.title,
						done: isTodayLine(current) && current.sets.length > 0,
						days: daysSince(current.date, current.year),
						top: top ? `${formatWeight(top.weight)}×${top.reps}` : "",
					};
				});
			const known = items.map((i) => i.days).filter((d) => d !== null);
			const lastDays = known.length ? Math.min(...known) : null;
			return {
				routine,
				items,
				done: items.filter((i) => i.done).length,
				last:
					lastDays === null
						? "Not trained yet"
						: lastDays === 0
							? "Trained today"
							: `Last trained ${lastDays}d ago`,
			};
		});
	});
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col gap-5"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<header class="flex items-center justify-between gap-4">
		<div class="flex flex-col gap-0.5">
			<h1 class="sr-only">Routines</h1>
			<span class="text-sm text-subtle">
				{#if $splits.length}
					{$splits.length} split{$splits.length === 1 ? "" : "s"} · {$routines.length} routine{$routines.length ===
					1
						? ""
						: "s"}
				{:else if $routines.length}
					{$routines.length} routine{$routines.length === 1 ? "" : "s"} · Train filters your exercise
					list
				{:else}
					Group exercises you train together
				{/if}
			</span>
		</div>
		<button
			onclick={() => (chooserOpen = true)}
			class="lg:hidden h-11 px-4 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-on-signal shrink-0"
		>
			<i class="i-tabler-plus block size-[18px] text-on-signal"></i>New
		</button>
	</header>

	{#if !loaded}
		<!-- loading -->
	{:else if cards.length === 0}
		<div
			class="flex flex-col items-center gap-3.5 py-14 px-4 text-center rounded-2xl bg-surface border-solid border-1 border-hairline"
		>
			<i class="i-tabler-list-details block size-8 text-faint"></i>
			<p class="text-subtle text-[15px] max-w-sm">
				Group exercises into routines, like a push or leg day, to filter your list while you train.
			</p>
			<button
				onclick={() => openSheet(null)}
				class="h-12 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-on-signal"
			>
				<i class="i-tabler-plus block size-[18px] text-on-signal"></i>
				Create your first routine
			</button>
		</div>
	{:else}
		{#if splitCards.length > 0}
			<section aria-labelledby="splits-head" class="flex flex-col gap-3">
				<h2 id="splits-head" class={sectionHead}>Splits</h2>
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 items-start">
					{#each splitCards as card (card.split.id)}
						<SplitCard
							split={card.split}
							status={card.status}
							{trained}
							routines={routinesById}
							{badges}
							{today}
							onedit={() => openSplit(card.split)}
						/>
					{/each}
				</div>
			</section>
			<h2 class="{sectionHead} -mb-2 mt-1">Routines</h2>
		{/if}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
			{#each cards as card (card.routine.id)}
				<article
					class="flex flex-col gap-3.5 p-4 rounded-2xl bg-surface border-solid border-1 border-hairline"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex flex-col gap-1 min-w-0">
							<h2
								class="m-0 font-display font-semibold text-[20px] leading-none flex items-center gap-2 min-w-0"
							>
								{#if $splits.length}<RoutineChip badge={badges.get(card.routine.id!)} />{/if}
								<span class="truncate">{card.routine.name}</span>
							</h2>
							<span class="text-[13px] text-subtle">
								{card.items.length} exercise{card.items.length === 1 ? "" : "s"} · {card.last}
							</span>
							{#if $splits.length}
								{@const inSplits = splitNames.get(card.routine.id!)}
								<span class="text-xs text-faint truncate">
									{inSplits ? `in ${inSplits.join(", ")}` : "in no split"}
								</span>
							{/if}
						</div>
						{#if card.items.length > 0}
							<div class="flex flex-col items-end gap-1.5 shrink-0">
								<span class="font-mono text-xs {card.done ? 'text-signal-ink' : 'text-subtle'}"
									>{card.done}/{card.items.length} today</span
								>
								<div class="flex gap-[3px]" aria-hidden="true">
									{#each card.items as item}
										<span class="w-2 h-4 rounded-[2px] {item.done ? 'bg-signal' : 'bg-edge'}"
										></span>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					{#if card.items.length > 0}
						<ul
							class="m-0 p-0 list-none flex flex-col rounded-xl bg-bg border-solid border-1 border-divider-2"
						>
							{#each card.items.slice(0, MAX_LISTED) as item (item.id)}
								<li
									class="flex items-center gap-2.5 px-3 py-2 border-b-solid border-b-1 border-b-rule last:border-b-0"
								>
									<span
										class="size-[7px] rounded-full shrink-0 {item.done ? 'bg-signal' : 'bg-edge'}"
									></span>
									<span class="flex-1 min-w-0 truncate text-sm">{item.title}</span>
									<span class="font-mono text-xs text-subtle shrink-0">{item.top}</span>
								</li>
							{/each}
							{#if card.items.length > MAX_LISTED}
								<li class="px-3 py-2 text-xs text-subtle">
									+{card.items.length - MAX_LISTED} more
								</li>
							{/if}
						</ul>
					{:else}
						<p class="text-sm text-subtle">No exercises yet. Add some with Edit.</p>
					{/if}

					<div class="flex gap-2">
						<a
							href="/?routine={card.routine.id}"
							class="flex-1 h-11 rounded-xl bg-signal no-underline flex items-center justify-center gap-2 text-[15px] font-semibold text-on-signal"
						>
							<i class="i-tabler-player-play block size-4 text-on-signal"></i>Train
						</a>
						<button
							onclick={() => openSheet(card.routine)}
							class="h-11 px-4 rounded-xl border-none bg-surface-3 cursor-pointer flex items-center gap-2 text-[15px]"
						>
							<i class="i-tabler-pencil block size-4"></i>Edit
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</main>

{#key sheetKey}
	<RoutineSheet routine={sheetRoutine} bind:showPopup={sheetOpen} />
{/key}

{#key splitKey}
	<SplitSheet
		split={splitEditing}
		routines={$routines}
		{trained}
		{badges}
		{today}
		bind:showPopup={splitOpen}
	/>
{/key}

{#snippet newOptions(close: () => void)}
	{@const noRoutines = $routines.length === 0}
	<button
		role="menuitem"
		disabled={noRoutines}
		onclick={() => {
			close();
			openSplit(null);
		}}
		class={newOption}
	>
		<span
			class="size-10 shrink-0 rounded-xl flex items-center justify-center"
			style="background: color-mix(in srgb, var(--signal) 14%, transparent)"
		>
			<i class="i-tabler-calendar-event block size-[21px] text-signal-ink"></i>
		</span>
		<span class="flex flex-col gap-[3px] min-w-0">
			<span class="text-[15px] font-semibold">New split</span>
			<span class="text-[12.5px] leading-snug text-subtle">
				{noRoutines
					? "Create a routine first, then put it on a schedule"
					: "Routines on a schedule, every few days or on fixed weekdays"}
			</span>
		</span>
	</button>
	<button
		role="menuitem"
		onclick={() => {
			close();
			openSheet(null);
		}}
		class={newOption}
	>
		<span class="size-10 shrink-0 rounded-xl bg-surface-3 flex items-center justify-center">
			<i class="i-tabler-list block size-[21px] text-soft"></i>
		</span>
		<span class="flex flex-col gap-[3px] min-w-0">
			<span class="text-[15px] font-semibold">New routine</span>
			<span class="text-[12.5px] leading-snug text-subtle"
				>Exercises you train together in one session</span
			>
		</span>
	</button>
{/snippet}

<Popup title="Create new" bind:showPopup={chooserOpen}>
	<div class="flex flex-col gap-1.5 pt-1">
		{@render newOptions(() => (chooserOpen = false))}
		<p class="m-0 pt-1.5 text-xs text-faint text-center">
			A routine can be part of several splits.
		</p>
	</div>
</Popup>

<Nav addLabel="New" addMenu={newOptions} />
