<script lang="ts">
	import type { Routine, Split } from "../idb";
	import type { Badge } from "#lib/routineBadges.js";
	import {
		WEEKDAYS,
		dayMonth,
		lastTrained,
		members,
		weekday,
		type SplitStatus,
	} from "#lib/splits.js";
	import RoutineChip from "#lib/ui/RoutineChip.svelte";

	let {
		split,
		status,
		trained,
		routines,
		badges,
		today,
		onedit,
	}: {
		split: Split;
		/** Two weeks from today; phones show the first one. */
		status: SplitStatus;
		trained: Map<number, string[]>;
		routines: Map<number, Routine>;
		badges: Map<number, Badge>;
		today: string;
		onedit: () => void;
	} = $props();

	const longDay = (iso: string) => `${WEEKDAYS[weekday(iso)]} ${dayMonth(iso)}`;
	const plural = [
		"Mondays",
		"Tuesdays",
		"Wednesdays",
		"Thursdays",
		"Fridays",
		"Saturdays",
		"Sundays",
	];

	const schedule = $derived.by(() => {
		if (split.kind === "rotation") {
			const every =
				split.pace === "gym-days"
					? WEEKDAYS.filter((_, i) => split.gymDays.includes(i)).join(", ") || "no days yet"
					: split.everyDays === 1
						? "every day"
						: `every ${split.everyDays} days`;
			const missed = split.keepOrder ? "the order is kept" : "the dates are kept";
			return { short: `Rotation · ${every}`, missed: `if you miss a day, ${missed}` };
		}
		const days = WEEKDAYS.filter((_, i) => split.days[i] !== null).join(", ") || "no days yet";
		const missed = split.catchUp ? "catch up on the next rest day" : "it's skipped";
		return { short: `Weekdays · ${days}`, missed: `if you miss a day, ${missed}` };
	});

	const next = $derived(status.next);
	const nextName = $derived(next ? (routines.get(next.routineId)?.name ?? "") : "");
	const nextNote = $derived(!next ? "" : next.date === today ? "due today" : longDay(next.date));

	/** The split's routines, each with a short note: when it was last done or comes next. */
	const rows = $derived.by(() => {
		const ids = members(split).filter((id) => routines.has(id));
		if (split.kind === "weekdays") {
			return ids.map((id) => {
				const days = WEEKDAYS.map((_, i) => i).filter((i) => split.days[i] === id);
				return {
					id,
					note: days.length === 1 ? plural[days[0]] : days.map((i) => WEEKDAYS[i]).join(", "),
					highlight: next?.routineId === id,
				};
			});
		}
		// The routine trained most recently says when; the next one says so; the rest their date.
		let latest: { id: number; date: string } | null = null;
		for (const id of ids) {
			const date = lastTrained(trained, id, today);
			if (date && (!latest || date >= latest.date)) latest = { id, date };
		}
		return ids.map((id) => {
			if (next?.routineId === id) {
				return {
					id,
					note: `next · ${next.date === today ? "today" : longDay(next.date)}`,
					highlight: true,
				};
			}
			if (latest?.id === id) {
				return {
					id,
					note: latest.date === today ? "done today" : `last ${longDay(latest.date)}`,
					highlight: false,
				};
			}
			const planned = status.days.find((d) => d.routineId === id && !d.done);
			return { id, note: planned ? longDay(planned.date) : "", highlight: false };
		});
	});
</script>

<article
	class="min-w-0 flex flex-col gap-3 lg:gap-3.5 p-3.5 lg:p-[18px] rounded-2xl bg-surface border-solid border-1 border-hairline"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex flex-col gap-0.5">
			<h2 class="m-0 font-display font-semibold text-[17px] lg:text-[19px] leading-tight truncate">
				{split.name}
			</h2>
			<span class="text-[12.5px] lg:text-[13px] text-subtle">
				{schedule.short}<span class="hidden lg:inline">{` · ${schedule.missed}`}</span>
			</span>
		</div>
		<button
			onclick={onedit}
			class="h-8 lg:h-[34px] px-3 rounded-[10px] border-none bg-surface-3 cursor-pointer flex items-center gap-1.5 text-[13px] text-soft shrink-0"
		>
			<i class="i-tabler-pencil block size-3.5 text-soft"></i>Edit
		</button>
	</div>

	<div class="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-[18px]">
		<div class="lg:w-[150px] shrink-0 flex flex-col gap-px">
			<span class="text-xs text-subtle">Up next</span>
			{#if next}
				<!-- Long names wrap onto a second line rather than being cut off in the narrow column. -->
				<span
					class="font-display font-semibold text-2xl leading-[1.1] break-words line-clamp-2 {nextName.length >
					9
						? 'lg:text-[22px]'
						: 'lg:text-[28px]'}">{nextName}</span
				>
				<span
					class="text-[12.5px] {next.date === today
						? 'text-signal-ink font-medium'
						: 'text-subtle'}">{nextNote}</span
				>
			{:else}
				<span class="text-sm text-subtle">Nothing planned yet</span>
			{/if}
		</div>

		<ol class="m-0 p-0 list-none flex-1 min-w-0 flex gap-0.5 -mx-1 lg:mx-0" aria-label="Next days">
			{#each status.days as day, i (day.date)}
				{@const isToday = day.date === today}
				<li
					class="flex-1 min-w-0 flex-col items-center gap-1 pt-[7px] pb-2 rounded-[10px] {i >= 7
						? 'hidden lg:flex'
						: 'flex'} {isToday ? 'bg-raised' : ''}"
					aria-label="{longDay(day.date)}: {day.routineId === null
						? 'rest'
						: (routines.get(day.routineId)?.name ?? '')}{day.done ? ', done' : ''}{day.moved
						? ', caught up'
						: ''}"
				>
					<small class="text-[10px] text-faint">{WEEKDAYS[weekday(day.date)]}</small>
					<b class="text-[12.5px] font-medium {isToday ? 'text-fg' : 'text-soft'}"
						>{Number(day.date.slice(8))}</b
					>
					{#if day.routineId !== null}
						<RoutineChip badge={badges.get(day.routineId)} done={day.done} moved={day.moved} />
					{:else}
						<span class="size-[5px] my-2 rounded-full bg-track"></span>
					{/if}
				</li>
			{/each}
		</ol>
	</div>

	<ol
		class="m-0 p-0 list-none flex flex-col lg:flex-row gap-[7px] lg:gap-2 pt-2.5 lg:pt-0 border-t-solid border-t-1 border-t-divider lg:border-t-0"
	>
		{#each rows as row, i (row.id)}
			<li
				class="lg:flex-1 min-w-0 flex items-center gap-2 lg:gap-[9px] lg:px-3 lg:py-2.5 lg:rounded-xl lg:bg-bg lg:border-solid lg:border-1 lg:border-divider-2 text-[13.5px] lg:text-sm"
			>
				<span class="w-2.5 text-[11px] text-faint shrink-0">{i + 1}</span>
				<RoutineChip badge={badges.get(row.id)} />
				<span class="flex-1 min-w-0 truncate {row.highlight ? 'font-medium text-fg' : 'text-soft'}"
					>{routines.get(row.id)?.name}</span
				>
				<span
					class="text-xs whitespace-nowrap shrink-0 {row.highlight
						? 'text-signal-ink'
						: 'text-faint'}">{row.note}</span
				>
			</li>
		{/each}
	</ol>
</article>
