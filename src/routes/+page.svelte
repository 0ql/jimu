<script lang="ts">
	import { onMount } from "svelte";
	import {
		exercises,
		loadExercises,
		loadRoutines,
		loadSplits,
		routines,
		splits,
		type Split,
	} from "./idb";
	import { formatKg, formatWeight, lineStats, parseLog } from "#lib/sets.js";
	import {
		WEEKDAYS,
		addDays,
		dayMonth,
		isoDate,
		lastTrained,
		splitStatus,
		trainedDates,
		weekday,
	} from "#lib/splits.js";
	import { parseSessions, sessionStats } from "#lib/sessions.js";
	import { routineBadges } from "#lib/routineBadges.js";
	import RoutineChip from "#lib/ui/RoutineChip.svelte";
	import ActivityCalendar from "./ActivityCalendar.svelte";
	import Nav from "./Nav.svelte";

	// Data comes from this device; the layout brings in what changed elsewhere when it starts.
	let loaded = $state(false);
	onMount(async () => {
		await Promise.all([loadExercises(), loadRoutines(), loadSplits()]);
		loaded = true;
	});

	const today = isoDate();
	const DAYS = 7;
	const badges = $derived(routineBadges($routines));
	const routinesById = $derived(new Map($routines.map((r) => [r.id!, r])));
	const trained = $derived(trainedDates({ routines: $routines, exercises: $exercises }));
	const statuses = $derived(
		$splits.map((split) => ({ split, status: splitStatus(split, trained, today, DAYS) })),
	);

	type Planned = { routineId: number; split: Split; done: boolean };
	/** The coming week across all splits: what each day has planned. */
	const week = $derived(
		Array.from({ length: DAYS }, (_, i) => ({
			date: addDays(today, i),
			items: statuses.flatMap(({ split, status }): Planned[] => {
				const day = status.days[i];
				return day.routineId !== null && routinesById.has(day.routineId)
					? [{ routineId: day.routineId, split, done: day.done }]
					: [];
			}),
		})),
	);

	const due = $derived(week[0].items.find((item) => !item.done) ?? null);
	const doneToday = $derived(week[0].items.filter((item) => item.done));
	/** The soonest routine after today, for a rest day. */
	const upcoming = $derived(
		week
			.slice(1)
			.flatMap((day) => day.items.map((item) => ({ ...item, date: day.date })))
			.at(0) ?? null,
	);

	const longDay = (iso: string) => `${WEEKDAYS[weekday(iso)]} ${dayMonth(iso)}`;
	const dayName = (iso: string) =>
		iso === today ? "Today" : iso === addDays(today, 1) ? "Tomorrow" : WEEKDAYS[weekday(iso)];

	/** The due routine's exercises with the top set from their last session. */
	const dueExercises = $derived.by(() => {
		if (!due) return [];
		const byId = new Map($exercises.map((e) => [e.id, e]));
		return [...new Set(routinesById.get(due.routineId)?.exerciseIds ?? [])]
			.map((id) => byId.get(id))
			.filter((e) => e !== undefined)
			.map((e) => {
				const top = lineStats(parseLog(e.workoutsString).current.sets).top;
				return {
					id: e.id!,
					title: e.title,
					top: top ? `${formatWeight(top.weight)}×${top.reps}` : "",
				};
			});
	});
	const dueLast = $derived(due ? lastTrained(trained, due.routineId, today) : null);
	/** What the due routine's split has after it. */
	const dueThen = $derived.by(() => {
		if (!due) return null;
		const status = statuses.find((s) => s.split === due.split)?.status;
		const later = status?.days.find((d) => d.date > today && d.routineId !== null);
		return later ? { routineId: later.routineId!, date: later.date } : null;
	});

	// Phones list the next few days with something planned; desktop shows the whole week.
	const phoneDays = $derived(
		new Set(
			week
				.slice(1)
				.filter((day) => day.items.length > 0)
				.slice(0, 3)
				.map((day) => day.date),
		),
	);

	const sessions = $derived(parseSessions($exercises));
	const stats = $derived(sessionStats(sessions));
	/** The routines counted on a day, for the recent sessions. */
	const routinesOn = (key: string) => $routines.filter((r) => trained.get(r.id!)?.includes(key));

	const card = "rounded-2xl bg-surface border-solid border-1 border-hairline";
	const sectionHead = "m-0 text-[11px] tracking-[0.08em] uppercase font-semibold text-subtle";
	const stat =
		"flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-surface border-solid border-1 border-hairline";
	const statValue =
		"font-display font-semibold text-[20px] lg:text-[22px] leading-[1.2] whitespace-nowrap";
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start gap-4 lg:gap-5"
	style="padding-top: calc(var(--nav-h, 1rem) + 1.25rem)"
>
	<h1 class="sr-only">Home</h1>

	<div class="flex flex-col gap-4">
		{#if !loaded}
			<!-- loading -->
		{:else if due}
			{@const routine = routinesById.get(due.routineId)!}
			<section
				aria-label="Due today"
				class="{card} p-4 flex flex-col gap-3.5"
				style="border-color: color-mix(in srgb, var(--signal) 18%, var(--hairline)); background: linear-gradient(180deg, color-mix(in srgb, var(--signal) 6%, transparent), transparent 55%), var(--surface)"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex flex-col gap-[3px]">
						<span class="text-[12.5px] font-medium text-signal-ink"
							>Due today · {due.split.name}</span
						>
						<h2 class="m-0 flex items-center gap-2.5 min-w-0">
							<RoutineChip badge={badges.get(due.routineId)} />
							<span class="font-display font-semibold text-[30px] leading-[1.1] truncate"
								>{routine.name}</span
							>
						</h2>
						<span class="text-[12.5px] text-subtle">
							{dueExercises.length} exercise{dueExercises.length === 1 ? "" : "s"}{dueLast
								? ` · last time ${longDay(dueLast)}`
								: ""}
						</span>
					</div>
					{#if dueThen}
						<span class="shrink-0 text-right text-xs leading-normal text-faint">
							then<br /><span class="text-soft"
								>{routinesById.get(dueThen.routineId)?.name} · {dayName(dueThen.date)}</span
							>
						</span>
					{/if}
				</div>
				{#if dueExercises.length}
					<ul class="m-0 p-0 list-none rounded-xl bg-bg border-solid border-1 border-divider-2">
						{#each dueExercises as exercise (exercise.id)}
							<li
								class="flex items-center gap-2.5 px-3 py-[9px] border-b-solid border-b-1 border-b-divider-2 last:border-b-0"
							>
								<span class="size-[7px] rounded-full shrink-0 bg-edge"></span>
								<span class="flex-1 min-w-0 truncate text-sm">{exercise.title}</span>
								<span class="font-mono text-xs text-subtle shrink-0">{exercise.top}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<a
					href="/exercises?routine={due.routineId}"
					class="h-12 rounded-xl bg-signal no-underline flex items-center justify-center gap-2 text-[15.5px] font-semibold text-on-signal"
				>
					<i class="i-tabler-player-play block size-[17px] text-on-signal"></i>Start {routine.name}
				</a>
			</section>
		{:else if $splits.length}
			<section aria-label="Today" class="{card} p-4 flex flex-col gap-3">
				<div class="flex items-center gap-3">
					<span
						class="size-11 shrink-0 rounded-[13px] bg-surface-3 flex items-center justify-center"
					>
						<i
							class="{doneToday.length
								? 'i-tabler-circle-check text-signal-ink'
								: 'i-tabler-moon text-subtle'} block size-[22px]"
						></i>
					</span>
					<span class="min-w-0 flex flex-col gap-0.5">
						<h2 class="m-0 font-display font-semibold text-[19px] leading-tight">
							{doneToday.length
								? `${doneToday.map((d) => routinesById.get(d.routineId)?.name).join(" and ")} done today`
								: "Nothing planned today"}
						</h2>
						{#if upcoming}
							<span class="text-[13px] text-subtle">
								Next up: <span class="text-fg">{routinesById.get(upcoming.routineId)?.name}</span>
								on
								{longDay(upcoming.date)} · {upcoming.split.name}
							</span>
						{/if}
					</span>
				</div>
				{#if upcoming && !doneToday.length}
					<a
						href="/exercises?routine={upcoming.routineId}"
						class="h-[42px] rounded-[11px] bg-surface-3 border-solid border-1 border-edge no-underline flex items-center justify-center text-sm text-soft"
						>Train {routinesById.get(upcoming.routineId)?.name} anyway</a
					>
				{/if}
			</section>
		{:else}
			<section aria-label="Get started" class="{card} p-4 flex flex-col gap-3">
				<span class="flex flex-col gap-[3px]">
					<h2 class="m-0 font-display font-semibold text-[17px]">See what's next here</h2>
					<span class="text-[13px] leading-snug text-subtle"
						>Put your routines on a schedule and the home page shows what's due today.</span
					>
				</span>
				<div class="flex gap-2">
					<a
						href="/routines"
						class="flex-1 h-[42px] rounded-[11px] bg-signal no-underline flex items-center justify-center text-sm font-semibold text-on-signal"
						>Create a split</a
					>
					<a
						href="/exercises"
						class="flex-1 h-[42px] rounded-[11px] bg-surface-3 no-underline flex items-center justify-center text-sm text-soft"
						>Log exercises</a
					>
				</div>
			</section>
		{/if}

		{#if loaded && $splits.length}
			{@const rows = week.filter((day) => phoneDays.has(day.date))}
			<section
				aria-labelledby="week-head"
				class="flex-col gap-2 {rows.length ? 'flex' : 'hidden lg:flex'}"
			>
				<div class="flex justify-between items-baseline">
					<h2 id="week-head" class={sectionHead}>This week</h2>
					<a href="/routines" class="text-[12.5px] text-subtle no-underline lg:hidden">Routines</a>
				</div>
				<ol class="m-0 p-0 list-none {card} overflow-hidden">
					{#each week as day (day.date)}
						{@const isToday = day.date === today}
						<li
							class="items-center gap-3 px-3.5 py-2.5 border-b-solid border-b-1 border-b-divider-2 last:border-b-0 {phoneDays.has(
								day.date,
							)
								? 'flex'
								: 'hidden lg:flex'} {isToday ? 'bg-lift' : ''}"
						>
							<span class="w-[78px] shrink-0 flex flex-col leading-tight">
								<b class="text-[13.5px] font-semibold {isToday ? 'text-signal-ink' : ''}"
									>{dayName(day.date)}</b
								>
								<small class="text-[11.5px] text-faint"
									>{isToday || day.date === addDays(today, 1)
										? longDay(day.date)
										: dayMonth(day.date)}</small
								>
							</span>
							{#if day.items.length === 0}
								<span class="text-[13px] text-faint">Rest day</span>
							{:else}
								<div class="min-w-0 flex flex-col gap-1.5">
									{#each day.items as item}
										<div class="flex items-center gap-2 min-w-0">
											<RoutineChip badge={badges.get(item.routineId)} done={item.done} />
											<span class="text-sm truncate {isToday ? 'font-medium' : ''}"
												>{routinesById.get(item.routineId)?.name}</span
											>
											<span class="text-xs text-faint truncate">{item.split.name}</span>
											{#if item.done}<i class="i-tabler-check block size-4 shrink-0 text-signal-ink"
												></i>{/if}
										</div>
									{/each}
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>

	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-2.5">
			<div class="{stat} flex">
				<span class="text-xs text-subtle">This week</span>
				<span class={statValue}>{stats.week}</span>
			</div>
			<div class="{stat} flex">
				<span class="text-xs text-subtle">4 weeks</span>
				<span class={statValue}>{stats.fourWeeks}</span>
			</div>
			<div class="{stat} flex">
				<span class="text-xs text-subtle">Avg volume</span>
				<span class={statValue}
					>{formatKg(stats.avgVolume)}<span class="text-sm text-subtle">&nbsp;kg</span></span
				>
			</div>
			<div class="{stat} hidden lg:flex">
				<span class="text-xs text-subtle">Streak</span>
				<span class={statValue}>{stats.streak} week{stats.streak === 1 ? "" : "s"}</span>
			</div>
		</div>

		<ActivityCalendar {sessions}>
			{#snippet action()}
				<a
					href="/sessions"
					class="flex items-center gap-0.5 text-[13px] text-soft no-underline lg:hidden"
					>All sessions<i class="i-tabler-chevron-right block size-[15px] text-soft"></i></a
				>
			{/snippet}
		</ActivityCalendar>

		{#if sessions.length}
			<section aria-labelledby="recent-head" class="hidden lg:flex flex-col gap-2">
				<div class="flex justify-between items-baseline">
					<h2 id="recent-head" class={sectionHead}>Recent sessions</h2>
					<a href="/sessions" class="text-[12.5px] text-subtle no-underline">All sessions</a>
				</div>
				<ol class="m-0 p-0 list-none {card} overflow-hidden">
					{#each sessions.slice(0, 3) as session (session.key)}
						{@const counted = routinesOn(session.key)}
						<li class="border-b-solid border-b-1 border-b-divider-2 last:border-b-0">
							<a
								href="/sessions#{session.key}"
								data-plain
								class="flex items-center gap-3 px-3.5 py-2.5 no-underline hover:bg-lift"
							>
								<span class="w-[86px] shrink-0 flex flex-col leading-tight">
									<b class="text-[13.5px] font-semibold">{dayMonth(session.key)}</b>
									<small class="text-[11.5px] text-faint"
										>{session.date.toLocaleDateString("en-US", { weekday: "long" })}</small
									>
								</span>
								{#each counted as routine (routine.id)}
									<RoutineChip badge={badges.get(routine.id!)} />
									<span class="text-sm">{routine.name}</span>
								{/each}
								<span class="text-xs text-faint"
									>{session.entries.length} exercise{session.entries.length === 1 ? "" : "s"}</span
								>
								<span class="ml-auto font-mono text-[12.5px] text-soft"
									>{formatKg(session.volume)} kg</span
								>
							</a>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>
</main>

<Nav />
