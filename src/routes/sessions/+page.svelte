<script lang="ts">
	import { onMount } from "svelte";
	import { exercises, loadExercises, type Exercise } from "../idb";
	import { datedLines, formatKg, lineStats, parseLine, type ParsedSet } from "#lib/sets.js";
	import Nav from "../Nav.svelte";

	type Entry = {
		id: number;
		title: string;
		tokens: { text: string; kind: ParsedSet["kind"] }[];
		volume: number;
	};
	type Session = { date: Date; key: string; entries: Entry[]; volume: number };

	let loaded = $state(false);
	onMount(async () => {
		await loadExercises();
		loaded = true;
	});

	const dayKey = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

	const parseSessions = (all: Exercise[]): Session[] => {
		const map = new Map<string, Session>();
		for (const exercise of all) {
			for (const { date, line: row } of datedLines(exercise.workoutsString)) {
				const { rest, sets } = parseLine(row);
				if (!sets.length) continue;
				const key = dayKey(date);
				if (!map.has(key)) map.set(key, { date, key, entries: [], volume: 0 });
				const session = map.get(key)!;
				const volume = lineStats(sets).volume;
				// Show the sets as typed (x8 stays x8), colored by kind.
				const tokens = rest
					.split(/\s+/)
					.filter(Boolean)
					.map((text, i) => ({ text, kind: sets[i].kind }));
				// The same day written twice in one log becomes one row (the list is keyed by exercise).
				const existing = session.entries.find((e) => e.id === exercise.id);
				if (existing) {
					existing.tokens.push(...tokens);
					existing.volume += volume;
				} else {
					session.entries.push({ id: exercise.id!, title: exercise.title, tokens, volume });
				}
				session.volume += volume;
			}
		}
		for (const s of map.values()) s.entries.sort((a, b) => a.title.localeCompare(b.title));
		return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
	};

	const sessions = $derived(parseSessions($exercises));

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const daysBack = (n: number) => new Date(today.getTime() - n * 86400000);
	const mondayOffset = (today.getDay() + 6) % 7;

	const stats = $derived.by(() => {
		const weekStart = daysBack(mondayOffset);
		const fourWeeks = daysBack(27);
		const recent = sessions.filter((s) => s.date >= fourWeeks);
		return {
			week: sessions.filter((s) => s.date >= weekStart).length,
			fourWeeks: recent.length,
			avgVolume: recent.length ? recent.reduce((sum, s) => sum + s.volume, 0) / recent.length : 0,
		};
	});

	// The activity calendar shows one calendar year: a column per week (Monday on top), a square
	// per day, shaded by how many exercises were logged that day.
	const DAY = 86400000;
	const thisYear = today.getFullYear();
	const firstYear = $derived(Math.min(thisYear, ...sessions.map((s) => s.date.getFullYear())));
	let year = $state(thisYear);

	const levelFor = (count: number) => (count >= 7 ? 4 : count >= 5 ? 3 : count >= 3 ? 2 : 1);
	const levelLegend = ["1–2", "3–4", "5–6", "7+"];
	const levelClass = [
		"bg-surface-3",
		"bg-[rgba(215,245,90,0.25)]",
		"bg-[rgba(215,245,90,0.45)]",
		"bg-[rgba(215,245,90,0.7)]",
		"bg-signal",
	];

	const calendar = $derived.by(() => {
		const byKey = new Map(sessions.map((s) => [s.key, s]));
		const jan1 = new Date(year, 0, 1);
		const start = new Date(year, 0, 1 - ((jan1.getDay() + 6) % 7));
		const dec31 = new Date(year, 11, 31);
		const end = new Date(year, 11, 31 + ((7 - dec31.getDay()) % 7));
		const weeks: {
			month: string | null;
			days: { inYear: boolean; future: boolean; today: boolean; level: number; label: string }[];
		}[] = [];
		let trained = 0;
		let exerciseCount = 0;
		for (
			let d = new Date(start);
			d <= end;
			d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
		) {
			const days = [];
			let month: string | null = null;
			for (let i = 0; i < 7; i++) {
				const date = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
				const inYear = date.getFullYear() === year;
				if (inYear && date.getDate() === 1) {
					month = date.toLocaleDateString("en-US", { month: "short" });
				}
				const session = inYear ? byKey.get(dayKey(date)) : undefined;
				const count = session?.entries.length ?? 0;
				if (count) {
					trained++;
					exerciseCount += count;
				}
				days.push({
					inYear,
					future: date > today,
					today: date.getTime() === today.getTime(),
					level: count ? levelFor(count) : 0,
					label: `${date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}: ${
						count ? `${count} exercise${count === 1 ? "" : "s"}` : "rest"
					}`,
				});
			}
			weeks.push({ month, days });
		}
		return {
			weeks,
			trained,
			average: trained ? exerciseCount / trained : 0,
		};
	});

	// Phones show the year as two half-years stacked, so every day stays visible without
	// scrolling and the squares stay big enough to read.
	let narrow = $state(false);
	$effect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		narrow = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (narrow = e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	});
	const blocks = $derived.by(() => {
		if (!narrow) return [calendar.weeks];
		const july = calendar.weeks.findIndex((w) => w.month === "Jul");
		return [calendar.weeks.slice(0, july), calendar.weeks.slice(july)];
	});
	const columns = $derived(Math.max(...blocks.map((b) => b.length)));

	const months = $derived.by(() => {
		const groups: { label: string; sessions: Session[] }[] = [];
		for (const s of sessions) {
			const label = s.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
			if (groups.at(-1)?.label !== label) groups.push({ label, sessions: [] });
			groups.at(-1)!.sessions.push(s);
		}
		return groups;
	});

	const tokenClass: Record<ParsedSet["kind"], string> = {
		warmup: "text-faint",
		work: "text-soft",
		drop: "text-drop",
		invalid: "text-invalid",
	};

	const dateLabel = (d: Date) =>
		d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
	const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long" });
	const relative = (d: Date) => {
		const days = Math.round((today.getTime() - d.getTime()) / 86400000);
		return days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : "";
	};
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col gap-6"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<h1 class="sr-only">Sessions</h1>
	<div>
		<div class="grid grid-cols-3 gap-2 lg:w-[460px]">
			<div
				class="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-surface border-solid border-1 border-hairline"
			>
				<span class="text-xs text-subtle">This week</span>
				<span class="font-display font-semibold text-[22px] leading-[1.2]">{stats.week}</span>
			</div>
			<div
				class="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-surface border-solid border-1 border-hairline"
			>
				<span class="text-xs text-subtle">4 weeks</span>
				<span class="font-display font-semibold text-[22px] leading-[1.2]">{stats.fourWeeks}</span>
			</div>
			<div
				class="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-surface border-solid border-1 border-hairline"
			>
				<span class="text-xs text-subtle">Avg volume</span>
				<span class="font-display font-semibold text-[22px] leading-[1.2] whitespace-nowrap"
					>{formatKg(stats.avgVolume)}<span class="text-base text-subtle">&nbsp;kg</span></span
				>
			</div>
		</div>
	</div>

	<section
		aria-labelledby="activity-head"
		class="flex flex-col gap-3 p-4 rounded-2xl bg-surface border-solid border-1 border-hairline"
	>
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div class="flex items-center gap-1">
				<button
					onclick={() => year--}
					disabled={year <= firstYear}
					aria-label="Previous year"
					class="size-8 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center justify-center disabled:opacity-35 disabled:cursor-default"
				>
					<i class="i-tabler-chevron-left block size-4 text-soft"></i>
				</button>
				<h2 id="activity-head" class="m-0 w-14 text-center text-[15px] font-semibold font-mono">
					{year}
				</h2>
				<button
					onclick={() => year++}
					disabled={year >= thisYear}
					aria-label="Next year"
					class="size-8 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center justify-center disabled:opacity-35 disabled:cursor-default"
				>
					<i class="i-tabler-chevron-right block size-4 text-soft"></i>
				</button>
			</div>
			<span class="text-[13px] text-subtle">
				<span class="text-fg font-semibold">{calendar.trained}</span> training day{calendar.trained ===
				1
					? ""
					: "s"}
				{#if calendar.trained}
					· <span class="text-fg font-semibold">{calendar.average.toFixed(1)}</span> exercises per day
				{/if}
			</span>
		</div>

		<div
			role="img"
			aria-label="{calendar.trained} training days in {year}"
			class="flex flex-col gap-3"
		>
			{#each blocks as weeks}
				<div class="flex gap-2" aria-hidden="true">
					<div
						class="grid grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px] text-[10px] text-faint font-mono shrink-0"
					>
						<span class="h-3.5"></span>
						{#each ["M", "", "W", "", "F", "", "S"] as d}
							<span class="flex items-center">{d}</span>
						{/each}
					</div>
					<div
						class="flex-1 min-w-0 grid gap-[3px]"
						style="grid-template-columns: repeat({columns}, minmax(0, 1fr))"
					>
						{#each weeks as week}
							<span class="h-3.5 text-[10px] leading-none text-faint whitespace-nowrap"
								>{week.month ?? ""}</span
							>
						{/each}
						{#each { length: 7 } as _, row}
							{#each weeks as week}
								{@const day = week.days[row]}
								<span
									title={day.inYear && !day.future ? day.label : undefined}
									style="grid-row: {row + 2}"
									class="aspect-square rounded-[2px] {!day.inYear
										? 'bg-transparent'
										: day.future
											? 'bg-surface-3 opacity-40'
											: levelClass[day.level]} {day.today ? 'outline outline-1 outline-fg' : ''}"
								></span>
							{/each}
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div class="flex items-center justify-end gap-1.5 text-[11px] text-faint" aria-hidden="true">
			<span class="mr-0.5">Exercises per day</span>
			{#each levelLegend as text, i}
				<span class="flex items-center gap-1">
					<span class="size-[11px] rounded-[2px] {levelClass[i + 1]}"></span>{text}
				</span>
			{/each}
		</div>
	</section>

	<section aria-label="Session history" class="flex-1 min-w-0 flex flex-col gap-5">
		{#if loaded && sessions.length === 0}
			<div
				class="flex flex-col items-center gap-3 py-14 px-4 text-center rounded-2xl bg-surface border-solid border-1 border-hairline"
			>
				<i class="i-tabler-calendar-event block size-8 text-faint"></i>
				<p class="text-subtle text-[15px] max-w-sm">
					Every day you log sets shows up here as a session.
				</p>
				<a
					href="/"
					class="h-12 px-4.5 rounded-xl bg-signal no-underline flex items-center gap-2 text-[15px] font-semibold text-on-signal"
					>Go to exercises</a
				>
			</div>
		{/if}

		{#each months as month (month.label)}
			<div class="flex flex-col gap-3">
				<h2
					class="m-0 font-display font-semibold text-[11px] tracking-[0.08em] uppercase text-subtle"
				>
					{month.label}
				</h2>
				{#each month.sessions as session (session.key)}
					<article
						class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden"
					>
						<header class="flex items-center gap-3 px-4 pt-3.5 pb-3">
							<div class="flex items-baseline gap-2.5 min-w-0 flex-1">
								<span class="font-display font-semibold text-[22px] leading-none"
									>{dateLabel(session.date)}</span
								>
								<span class="text-sm text-subtle truncate">
									{weekday(session.date)}{relative(session.date)
										? ` · ${relative(session.date)}`
										: ""}
								</span>
							</div>
							<div class="flex flex-col items-end shrink-0">
								<span class="font-display font-semibold text-[18px] leading-none"
									>{formatKg(session.volume)} kg</span
								>
								<span class="text-xs text-subtle">
									{session.entries.length} exercise{session.entries.length === 1 ? "" : "s"}
								</span>
							</div>
						</header>
						<ul class="m-0 p-0 list-none border-t-solid border-t-1 border-t-divider">
							{#each session.entries as entry (entry.id)}
								<li
									class="flex flex-wrap sm:flex-nowrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 border-b-solid border-b-1 border-b-lift last:border-b-0"
								>
									<a
										href="/?exercise={entry.id}"
										data-plain
										class="sm:w-[38%] shrink-0 min-w-0 truncate no-underline text-[15px] font-semibold hover:text-signal-ink"
										>{entry.title}</a
									>
									<span class="flex-1 min-w-0 font-mono text-[13px] text-soft truncate">
										{#each entry.tokens as token, i}{#if i}&ensp;{/if}<span
												class={tokenClass[token.kind]}>{token.text}</span
											>{/each}
									</span>
									<span class="font-mono text-xs text-subtle shrink-0 ml-auto"
										>{formatKg(entry.volume)} kg</span
									>
								</li>
							{/each}
						</ul>
					</article>
				{/each}
			</div>
		{/each}
	</section>
</main>

<Nav />
