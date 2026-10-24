<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { exercises, loadExercises, type Exercise } from "../idb";
	import { datedLines, formatKg, formatWeight, parseLine, type ParsedSet } from "#lib/sets.js";
	import Nav from "../Nav.svelte";
	import ProgressChart from "./ProgressChart.svelte";
	import SearchBar from "../SearchBar.svelte";

	type Metric = "volume" | "top" | "e1rm" | "reps";
	type Range = "3m" | "6m" | "1y" | "all";
	type Session = {
		date: Date;
		tokens: { text: string; kind: ParsedSet["kind"] }[];
		volume: number;
		top: number | null;
		e1rm: number | null;
		reps: number;
	};

	const METRICS: { id: Metric; label: string; hint: string }[] = [
		{ id: "volume", label: "Volume", hint: "kg · weight × reps of working and drop sets" },
		{ id: "top", label: "Top weight", hint: "kg · heaviest working set" },
		{ id: "e1rm", label: "Est. 1RM", hint: "kg · best working set, Epley formula" },
		{ id: "reps", label: "Reps", hint: "reps · working and drop sets" },
	];
	const RANGES: { id: Range; label: string; days: number | null }[] = [
		{ id: "3m", label: "3M", days: 91 },
		{ id: "6m", label: "6M", days: 182 },
		{ id: "1y", label: "1Y", days: 365 },
		{ id: "all", label: "All", days: null },
	];

	let metric = $state<Metric>("volume");
	let range = $state<Range>("6m");
	let selectedId: number | null = $state(null);
	let query = $state("");

	// Empty states wait for IndexedDB so they don't flash on every visit.
	let loaded = $state(false);

	onMount(async () => {
		await loadExercises();
		loaded = true;
		const id = Number(page.url.searchParams.get("exercise"));
		if (id && $exercises.some((e) => e.id === id)) selectedId = id;
	});

	/** One entry per training day; a day written twice in the log is merged. */
	const sessionsOf = (exercise: Exercise): Session[] => {
		const byDay = new Map<number, Session>();
		for (const { date, line } of datedLines(exercise.workoutsString)) {
			const { rest, sets } = parseLine(line);
			if (!sets.length) continue;
			const tokens = rest
				.split(/\s+/)
				.filter(Boolean)
				.map((text, i) => ({ text, kind: sets[i].kind }));
			const s = byDay.get(date.getTime()) ?? {
				date,
				tokens: [],
				volume: 0,
				top: null,
				e1rm: null,
				reps: 0,
			};
			s.tokens.push(...tokens);
			for (const set of sets) {
				if (set.kind === "invalid" || set.kind === "warmup") continue;
				s.reps += set.reps;
				if (set.weight === null) continue;
				s.volume += set.weight * set.reps;
				if (set.kind !== "work") continue;
				s.top = Math.max(s.top ?? 0, set.weight);
				s.e1rm = Math.max(s.e1rm ?? 0, set.weight * (1 + set.reps / 30));
			}
			byDay.set(date.getTime(), s);
		}
		return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
	};

	const overview = $derived(
		$exercises
			.map((e) => ({ exercise: e, sessions: sessionsOf(e) }))
			.sort((a, b) => a.exercise.title.localeCompare(b.exercise.title)),
	);
	const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
	const listed = $derived(
		overview.filter((o) => norm(o.exercise.title).includes(norm(query.trim()))),
	);

	// Default to the most recently trained exercise.
	const selected = $derived.by(() => {
		const picked = overview.find((o) => o.exercise.id === selectedId);
		if (picked) return picked;
		return [...overview].sort(
			(a, b) => (b.sessions.at(-1)?.date.getTime() ?? 0) - (a.sessions.at(-1)?.date.getTime() ?? 0),
		)[0];
	});

	// Same keys as the exercises page: / focuses the filter, ↑↓ switch, Esc clears.
	let searchInput: HTMLInputElement | undefined = $state();
	const move = (step: number) => {
		if (!listed.length) return;
		const i = listed.findIndex((o) => o.exercise.id === selected?.exercise.id);
		selectedId = listed[Math.min(listed.length - 1, Math.max(0, i + step))].exercise.id!;
	};
	const onSearchKey = (e: KeyboardEvent) => {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			move(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Escape") {
			query = "";
		}
	};
	const onWindowKey = (e: KeyboardEvent) => {
		if (e.key !== "/" || !searchInput?.offsetParent) return;
		if ((e.target as HTMLElement).closest("input, textarea, select")) return;
		e.preventDefault();
		searchInput.focus();
	};

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const inRange = $derived.by(() => {
		if (!selected) return [];
		const days = RANGES.find((r) => r.id === range)!.days;
		if (days === null) return selected.sessions;
		const from = today.getTime() - days * 86400000;
		return selected.sessions.filter((s) => s.date.getTime() >= from);
	});

	const valueOf = (s: Session) => s[metric];
	const format = (n: number) =>
		metric === "reps"
			? formatKg(n)
			: n >= 1000
				? `${formatKg(n)} kg`
				: `${formatWeight(Math.round(n * 10) / 10)} kg`;

	const points = $derived(
		inRange
			.filter((s) => valueOf(s) !== null)
			.map((s) => ({
				date: s.date,
				value: valueOf(s)!,
				detail: s.tokens.map((t) => t.text).join(" "),
			})),
	);

	const stats = $derived.by(() => {
		if (!points.length) return null;
		const latest = points.at(-1)!;
		const previous = points.at(-2);
		const best = points.reduce((a, b) => (b.value > a.value ? b : a));
		const first = points[0];
		return {
			latest,
			delta: previous ? latest.value - previous.value : null,
			best,
			change:
				points.length > 1 && first.value
					? ((latest.value - first.value) / first.value) * 100
					: null,
		};
	});

	const signed = (n: number, f: (n: number) => string) =>
		`${n > 0 ? "+" : n < 0 ? "−" : "±"}${f(Math.abs(n))}`;
	const shortDate = (d: Date) =>
		d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
	const tokenClass: Record<ParsedSet["kind"], string> = {
		warmup: "text-faint",
		work: "text-soft",
		drop: "text-drop",
		invalid: "text-invalid",
	};
	const tile =
		"flex flex-col gap-0.5 px-3.5 py-3 rounded-xl bg-surface border-solid border-1 border-hairline min-w-0";
	const tileValue =
		"font-display font-semibold text-[22px] leading-[1.2] whitespace-nowrap truncate";
	const segment = (on: boolean) =>
		`flex-1 lg:flex-none h-9 px-2 lg:px-3.5 rounded-lg border-none cursor-pointer text-[13px] lg:text-sm font-semibold whitespace-nowrap ${on ? "bg-dark text-bg" : "bg-transparent text-soft hover:bg-surface-3"}`;
</script>

<svelte:window onkeydown={onWindowKey} />

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 lg:pb-5 flex flex-col lg:flex-row lg:items-start gap-6"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<aside
		aria-label="Exercises"
		class="hidden lg:flex w-[340px] xl:w-[380px] shrink-0 sticky flex-col gap-3"
		style="top: calc(var(--nav-h, 5rem) + 1.25rem); max-height: calc(100dvh - var(--nav-h, 5rem) - 2.5rem)"
	>
		<SearchBar
			bind:value={query}
			bind:input={searchInput}
			hint="/"
			placeholder="Filter exercises"
			label="Filter exercises"
			onkeydown={onSearchKey}
		/>
		<div
			class="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-surface border-solid border-1 border-hairline"
		>
			{#each listed as o (o.exercise.id)}
				{@const on = o.exercise.id === selected?.exercise.id}
				<button
					onclick={() => (selectedId = o.exercise.id!)}
					aria-current={on ? "true" : undefined}
					class="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none border-b-solid border-b-1 border-b-divider-2 last:border-b-0 text-left cursor-pointer {on
						? 'bg-selected'
						: 'bg-transparent hover:bg-lift'}"
				>
					<span
						class="flex-1 min-w-0 truncate text-[15px] font-semibold {on
							? 'text-fg'
							: 'text-strong'}">{o.exercise.title}</span
					>
					<span class="font-mono text-xs text-subtle shrink-0">{o.sessions.length}×</span>
				</button>
			{:else}
				{#if loaded}
					<p class="px-3.5 py-4 text-sm text-subtle">No exercise matches “{query.trim()}”</p>
				{/if}
			{/each}
		</div>
	</aside>

	<section class="flex-1 min-w-0 flex flex-col gap-4" aria-label="Progress">
		{#if selected}
			<div class="flex items-center lg:items-end justify-between gap-2 lg:gap-6">
				<div class="flex flex-col gap-1 min-w-0 flex-1">
					<h1
						class="hidden lg:block m-0 font-display font-semibold text-[32px] leading-none truncate"
					>
						{selected.exercise.title}
					</h1>
					<label class="lg:hidden relative block">
						<span class="sr-only">Exercise</span>
						<select
							value={selected.exercise.id}
							onchange={(e) => (selectedId = Number(e.currentTarget.value))}
							class="w-full appearance-none h-12 pl-3.5 pr-10 rounded-xl bg-surface border-solid border-1 border-hairline font-display font-semibold text-[18px] outline-none cursor-pointer"
						>
							{#each overview as o (o.exercise.id)}
								<option value={o.exercise.id} class="bg-bg text-base font-sans"
									>{o.exercise.title}</option
								>
							{/each}
						</select>
						<i
							class="i-tabler-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 size-5 pointer-events-none text-subtle"
						></i>
					</label>
				</div>
				<!-- Phones: a square icon button matching the exercise picker beside it.
				     Desktop: a labelled button like "Progress chart" on the exercises page. -->
				<a
					href="/?exercise={selected.exercise.id}"
					aria-label="Open log"
					class="size-12 lg:size-auto lg:h-10 lg:px-3.5 rounded-xl lg:rounded-[10px] bg-surface lg:bg-surface-3 border-solid border-1 border-hairline lg:border-transparent no-underline flex items-center justify-center gap-2 text-sm shrink-0"
				>
					<i class="i-tabler-notes block size-5 lg:size-4"></i><span class="hidden lg:inline"
						>Open log</span
					>
				</a>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-3">
				<div
					role="group"
					aria-label="Metric"
					class="w-full lg:w-auto flex gap-1 p-1 rounded-xl bg-surface border-solid border-1 border-hairline"
				>
					{#each METRICS as m}
						<button
							aria-pressed={metric === m.id}
							onclick={() => (metric = m.id)}
							class={segment(metric === m.id)}>{m.label}</button
						>
					{/each}
				</div>
				<div
					role="group"
					aria-label="Time range"
					class="w-full lg:w-auto flex gap-1 p-1 rounded-xl bg-surface border-solid border-1 border-hairline"
				>
					{#each RANGES as r}
						<button
							aria-pressed={range === r.id}
							onclick={() => (range = r.id)}
							class={segment(range === r.id)}>{r.label}</button
						>
					{/each}
				</div>
			</div>

			{#if stats}
				<div class="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
					<div class={tile}>
						<span class="text-xs text-subtle">Latest · {shortDate(stats.latest.date)}</span>
						<span class={tileValue}>{format(stats.latest.value)}</span>
						{#if stats.delta !== null}
							<span
								class="font-mono text-xs {stats.delta > 0
									? 'text-signal-ink'
									: stats.delta < 0
										? 'text-drop'
										: 'text-subtle'}">{signed(stats.delta, format)} vs previous</span
							>
						{/if}
					</div>
					<div class={tile}>
						<span class="text-xs text-subtle">Best in range</span>
						<span class={tileValue}>{format(stats.best.value)}</span>
						<span class="font-mono text-xs text-subtle">{shortDate(stats.best.date)}</span>
					</div>
					<div class={tile}>
						<span class="text-xs text-subtle">Change in range</span>
						<span
							class="{tileValue} {stats.change === null
								? ''
								: stats.change > 0
									? 'text-signal-ink'
									: stats.change < 0
										? 'text-drop'
										: ''}"
						>
							{stats.change === null ? "—" : signed(Math.round(stats.change), (n) => `${n}%`)}
						</span>
						<span class="font-mono text-xs text-subtle">first to latest session</span>
					</div>
					<div class={tile}>
						<span class="text-xs text-subtle">Sessions in range</span>
						<span class={tileValue}>{points.length}</span>
						<span class="font-mono text-xs text-subtle">{selected.sessions.length} all time</span>
					</div>
				</div>
			{/if}

			<section
				aria-label="Chart"
				class="p-4 sm:p-5 rounded-2xl bg-surface border-solid border-1 border-hairline flex flex-col gap-3"
			>
				<div class="flex flex-wrap justify-between items-baseline gap-2">
					<h2 class="m-0 text-[15px] font-semibold">
						{METRICS.find((m) => m.id === metric)!.label} per session
					</h2>
					<span class="text-xs text-subtle">{METRICS.find((m) => m.id === metric)!.hint}</span>
				</div>
				{#if points.length}
					<ProgressChart {points} label={METRICS.find((m) => m.id === metric)!.label} {format} />
				{:else}
					<p class="py-16 text-center text-sm text-subtle">
						{selected.sessions.length
							? "No sessions in this range. Try a longer one."
							: "No sessions logged yet."}
					</p>
				{/if}
			</section>

			{#if inRange.length}
				<section
					aria-label="Sessions"
					class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden"
				>
					<h2 class="m-0 px-4 sm:px-5 pt-4 pb-2 text-[15px] font-semibold">Sessions</h2>
					<div class="overflow-x-auto">
						<table class="w-full border-collapse text-left">
							<thead>
								<tr class="text-xs text-subtle">
									<th class="font-normal px-4 sm:px-5 py-2">Date</th>
									<th class="font-normal px-3 py-2">Sets</th>
									<th class="font-normal px-3 py-2 text-right">Volume</th>
									<th class="font-normal px-3 py-2 text-right">Top</th>
									<th class="font-normal px-4 sm:px-5 py-2 text-right">Est. 1RM</th>
								</tr>
							</thead>
							<tbody>
								{#each [...inRange].reverse() as s (s.date.getTime())}
									<tr class="border-t-solid border-t-1 border-t-divider font-mono text-[13px]">
										<td class="px-4 sm:px-5 py-2.5 text-faint whitespace-nowrap"
											>{shortDate(s.date)}</td
										>
										<td class="px-3 py-2.5 whitespace-nowrap">
											{#each s.tokens as t, i}{#if i}&ensp;{/if}<span class={tokenClass[t.kind]}
													>{t.text}</span
												>{/each}
										</td>
										<td class="px-3 py-2.5 text-right whitespace-nowrap">{formatKg(s.volume)}</td>
										<td class="px-3 py-2.5 text-right whitespace-nowrap"
											>{s.top === null ? "—" : formatWeight(s.top)}</td
										>
										<td class="px-4 sm:px-5 py-2.5 text-right whitespace-nowrap"
											>{s.e1rm === null ? "—" : formatWeight(Math.round(s.e1rm * 10) / 10)}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{:else if loaded && $exercises.length === 0}
			<p class="text-subtle py-16 text-center">Log some sets first, then come back for charts.</p>
		{/if}
	</section>
</main>

<Nav />
