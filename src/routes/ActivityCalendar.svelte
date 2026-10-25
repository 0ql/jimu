<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Session } from "#lib/sessions.js";
	import { isoDate } from "#lib/splits.js";

	/**
	 * One calendar year: a column per week (Monday on top), a square per day, shaded by how many
	 * exercises were logged that day. A day with a session links to it in the sessions list.
	 */
	let { sessions, action = undefined }: { sessions: Session[]; action?: Snippet } = $props();

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayKey = isoDate(today);
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
			days: {
				key: string;
				inYear: boolean;
				future: boolean;
				today: boolean;
				level: number;
				label: string;
			}[];
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
				const key = isoDate(date);
				const inYear = date.getFullYear() === year;
				if (inYear && date.getDate() === 1) {
					month = date.toLocaleDateString("en-US", { month: "short" });
				}
				const session = inYear ? byKey.get(key) : undefined;
				const count = session?.entries.length ?? 0;
				if (count) {
					trained++;
					exerciseCount += count;
				}
				days.push({
					key,
					inYear,
					future: date > today,
					today: key === todayKey,
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
</script>

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
		{@render action?.()}
	</div>
	<span class="text-[13px] text-subtle -mt-1">
		<span class="text-fg font-semibold">{calendar.trained}</span> training day{calendar.trained ===
		1
			? ""
			: "s"}
		{#if calendar.trained}
			· <span class="text-fg font-semibold">{calendar.average.toFixed(1)}</span> exercises per day
		{/if}
	</span>

	<div class="flex flex-col gap-3">
		{#each blocks as weeks}
			<div class="flex gap-2">
				<div
					class="grid grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px] text-[10px] text-faint font-mono shrink-0"
					aria-hidden="true"
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
						<span
							class="h-3.5 text-[10px] leading-none text-faint whitespace-nowrap"
							aria-hidden="true">{week.month ?? ""}</span
						>
					{/each}
					{#each { length: 7 } as _, row}
						{#each weeks as week}
							{@const day = week.days[row]}
							{@const cell = `aspect-square rounded-[2px] ${
								!day.inYear
									? "bg-transparent"
									: day.future
										? "bg-surface-3 opacity-40"
										: levelClass[day.level]
							} ${day.today ? "outline outline-1 outline-fg" : ""}`}
							{#if day.inYear && day.level > 0}
								<a
									href="/sessions#{day.key}"
									title={day.label}
									aria-label={day.label}
									data-plain
									style="grid-row: {row + 2}"
									class="{cell} block hover:outline hover:outline-1 hover:outline-soft"
								></a>
							{:else}
								<span
									title={day.inYear && !day.future ? day.label : undefined}
									aria-hidden="true"
									style="grid-row: {row + 2}"
									class={cell}
								></span>
							{/if}
						{/each}
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="flex items-center justify-between gap-3 text-[11px] text-faint" aria-hidden="true">
		<span>Tap a day to see it</span>
		<span class="flex items-center gap-1.5">
			<span class="hidden sm:inline mr-0.5">Exercises per day</span>
			<span class="sm:hidden">Less</span>
			{#each levelLegend as text, i}
				<span class="flex items-center gap-1">
					<span class="size-[11px] rounded-[2px] {levelClass[i + 1]}"></span><span
						class="hidden sm:inline">{text}</span
					>
				</span>
			{/each}
			<span class="sm:hidden">More</span>
		</span>
	</div>
</section>
