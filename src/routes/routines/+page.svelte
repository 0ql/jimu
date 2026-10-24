<script lang="ts">
	import { onMount } from "svelte";
	import { exercises, loadExercises, loadRoutines, routines, type Routine } from "../idb";
	import { daysSince, isTodayLine, formatWeight, lineStats, parseLog } from "#lib/sets.js";
	import Nav from "../Nav.svelte";
	import RoutineSheet from "./RoutineSheet.svelte";

	onMount(async () => {
		await loadExercises();
		await loadRoutines();
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

	const MAX_LISTED = 6;

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
				{#if $routines.length}
					{$routines.length} routine{$routines.length === 1 ? "" : "s"} · Train filters your exercise
					list
				{:else}
					Group exercises you train together
				{/if}
			</span>
		</div>
		<button
			onclick={() => openSheet(null)}
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
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
			{#each cards as card (card.routine.id)}
				<article
					class="flex flex-col gap-3.5 p-4 rounded-2xl bg-surface border-solid border-1 border-hairline"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex flex-col gap-1 min-w-0">
							<h2 class="m-0 font-display font-semibold text-[20px] leading-none truncate">
								{card.routine.name}
							</h2>
							<span class="text-[13px] text-subtle">
								{card.items.length} exercise{card.items.length === 1 ? "" : "s"} · {card.last}
							</span>
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

<Nav onadd={() => openSheet(null)} addLabel="New routine" />
