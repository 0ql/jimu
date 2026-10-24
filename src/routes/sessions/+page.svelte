<script lang="ts">
	import { onMount } from "svelte";
	import { exercises, loadExercises, type Exercise } from "../idb";
	import { datedLines, formatKg, lineStats, parseLine, type ParsedSet } from "$lib/sets";
	import Nav from "../Nav.svelte";

	const HEATMAP_WEEKS = 16;

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

	const heatmap = $derived.by(() => {
		const byKey = new Map(sessions.map((s) => [s.key, s]));
		const start = daysBack(mondayOffset + (HEATMAP_WEEKS - 1) * 7);
		const max = Math.max(1, ...sessions.filter((s) => s.date >= start).map((s) => s.volume));
		const weeks = [];
		for (let w = 0; w < HEATMAP_WEEKS; w++) {
			const days = [];
			for (let d = 0; d < 7; d++) {
				const date = new Date(start.getTime() + (w * 7 + d) * 86400000);
				const session = byKey.get(dayKey(date));
				const ratio = session ? session.volume / max : 0;
				days.push({
					future: date > today,
					label: `${date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}: ${
						session ? `${session.entries.length} exercises, ${formatKg(session.volume)} kg` : "rest"
					}`,
					level: !session ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1,
				});
			}
			weeks.push(days);
		}
		return weeks;
	});
	const levelClass = [
		"bg-surface-3",
		"bg-[rgba(215,245,90,0.25)]",
		"bg-[rgba(215,245,90,0.45)]",
		"bg-[rgba(215,245,90,0.7)]",
		"bg-signal",
	];

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
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col lg:flex-row lg:items-start gap-6"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<aside
		class="lg:w-[380px] lg:shrink-0 lg:sticky flex flex-col gap-4"
		style="top: calc(var(--nav-h, 5rem) + 1.25rem)"
	>
		<div class="flex flex-col gap-0.5">
			<h1 class="m-0 font-display font-semibold text-[30px] leading-none">Sessions</h1>
			<span class="text-sm text-subtle">
				{sessions.length} training day{sessions.length === 1 ? "" : "s"} logged
			</span>
		</div>

		<div class="grid grid-cols-3 gap-2">
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

		<section
			aria-label="Activity"
			class="flex flex-col gap-3 p-4 rounded-2xl bg-surface border-solid border-1 border-hairline"
		>
			<div class="flex justify-between items-baseline">
				<h2 class="m-0 text-[15px] font-semibold">Last {HEATMAP_WEEKS} weeks</h2>
				<span class="text-xs text-subtle">shade = volume</span>
			</div>
			<div class="flex gap-2">
				<div class="grid grid-rows-7 gap-[3px] text-[10px] text-faint font-mono" aria-hidden="true">
					{#each ["M", "", "W", "", "F", "", "S"] as d}
						<span class="h-[15px] leading-[15px]">{d}</span>
					{/each}
				</div>
				<div
					role="img"
					aria-label="Training days over the last {HEATMAP_WEEKS} weeks: {stats.fourWeeks} sessions in the last 4 weeks"
					class="flex-1 grid gap-[3px]"
					style="grid-template-columns: repeat({HEATMAP_WEEKS}, minmax(0, 1fr))"
				>
					{#each heatmap as week}
						<div class="grid grid-rows-7 gap-[3px]">
							{#each week as day}
								<span
									title={day.future ? undefined : day.label}
									class="h-[15px] rounded-[3px] {day.future
										? 'bg-transparent'
										: levelClass[day.level]}"
								></span>
							{/each}
						</div>
					{/each}
				</div>
			</div>
			<div class="flex items-center justify-end gap-1 text-[10px] text-faint" aria-hidden="true">
				less
				{#each levelClass as cls}
					<span class="size-[11px] rounded-[2px] {cls}"></span>
				{/each}
				more
			</div>
		</section>
	</aside>

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
