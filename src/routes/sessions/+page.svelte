<script lang="ts">
	import { unit } from "#lib/unit.js";
	import { onMount, tick } from "svelte";
	import { exercises, loadExercises, loadRoutines, routines } from "../idb";
	import { formatKg, type ParsedSet } from "#lib/sets.js";
	import { parseSessions, type Session } from "#lib/sessions.js";
	import { trainedDates } from "#lib/splits.js";
	import { routineBadges } from "#lib/routineBadges.js";
	import { toTyped } from "#lib/setLetters.js";
	import RoutineChip from "#lib/ui/RoutineChip.svelte";
	import Nav from "../Nav.svelte";

	let loaded = $state(false);
	onMount(async () => {
		await Promise.all([loadExercises(), loadRoutines()]);
		loaded = true;
		// Opened from a day in the home calendar (/sessions#2026-10-23): go to that day once the
		// list is there, since the browser looked for it before the data had loaded.
		await tick();
		const day = location.hash.slice(1);
		if (day) document.getElementById(day)?.scrollIntoView({ block: "start" });
	});

	const sessions = $derived(parseSessions($exercises));
	const badges = $derived(routineBadges($routines));
	const trained = $derived(trainedDates({ routines: $routines, exercises: $exercises }));
	/** The routines a day was counted for. */
	const routinesOn = (key: string) => $routines.filter((r) => trained.get(r.id!)?.includes(key));

	const today = new Date();
	today.setHours(0, 0, 0, 0);

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
	<!-- Sessions are part of Home: back to it, on desktop inline (phones have it in the top bar). -->
	<div class="hidden lg:flex items-center gap-3">
		<a href="/" class="flex items-center gap-1 text-sm text-subtle no-underline"
			><i class="i-tabler-chevron-left block size-[18px] text-subtle"></i>Home</a
		>
		<h1 class="m-0 font-display font-semibold text-[22px]">Sessions</h1>
	</div>

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
					href="/exercises"
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
					{@const counted = routinesOn(session.key)}
					<article
						id={session.key}
						class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden"
						style="scroll-margin-top: calc(var(--nav-h, 4rem) + 1rem)"
					>
						<header class="flex items-center gap-3 px-4 pt-3.5 pb-3">
							<div class="flex items-baseline gap-2.5 min-w-0 flex-1">
								<span class="font-display font-semibold text-[22px] leading-none"
									>{dateLabel(session.date)}</span
								>
								<span class="min-w-0 flex flex-col gap-0.5">
									<span class="text-sm text-subtle truncate">
										{weekday(session.date)}{relative(session.date)
											? ` · ${relative(session.date)}`
											: ""}
									</span>
									{#if counted.length}
										<span class="flex items-center gap-1.5 text-[13px] min-w-0">
											{#each counted as routine (routine.id)}
												<RoutineChip badge={badges.get(routine.id!)} />
												<span class="truncate">{routine.name}</span>
											{/each}
										</span>
									{/if}
								</span>
							</div>
							<div class="flex flex-col items-end shrink-0">
								<span class="font-display font-semibold text-[18px] leading-none"
									>{formatKg(session.volume)} {unit()}</span
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
										href="/exercises?exercise={entry.id}"
										data-plain
										class="sm:w-[38%] shrink-0 min-w-0 truncate no-underline text-[15px] font-semibold hover:text-signal-ink"
										>{entry.title}</a
									>
									<span class="flex-1 min-w-0 font-mono text-[13px] text-soft truncate">
										{#each entry.tokens as token, i}{#if i}&ensp;{/if}<span
												class={tokenClass[token.kind]}>{toTyped(token.text)}</span
											>{/each}
									</span>
									<span class="font-mono text-xs text-subtle shrink-0 ml-auto"
										>{formatKg(entry.volume)} {unit()}</span
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

<Nav>
	<div class="lg:hidden h-12 -mt-1 flex items-center">
		<a href="/" class="flex items-center gap-0.5 pr-2 text-sm text-soft no-underline"
			><i class="i-tabler-chevron-left block size-6 text-soft"></i>Home</a
		>
		<h1 class="m-0 flex-1 text-center font-display font-semibold text-[17px] pr-16">Sessions</h1>
	</div>
</Nav>
