<script lang="ts">
	import { onMount } from "svelte";
	import { exercises, loadExercises, type Exercise } from "../idb";
	import Nav from "../Nav.svelte";
	import Card from "$lib/ui/Card.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";

	const START_YEAR = 2023;

	type Session = {
		date: Date;
		dateKey: string;
		exercises: string[];
	};

	let sessions: Session[] = $state([]);

	const parseSessions = (allExercises: Exercise[]) => {
		const map = new Map<string, Set<string>>();

		for (const exercise of allExercises) {
			if (!exercise.workoutsString.trim()) continue;

			const lines = exercise.workoutsString.split("\n");
			let year = START_YEAR;
			let lastMonth = 0;

			for (const row of lines) {
				const dateMatch = row.match(/^(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})\.)?/);
				if (!dateMatch) continue;

				const day = parseInt(dateMatch[1]);
				const month = parseInt(dateMatch[2]);

				if (dateMatch[3] !== undefined) {
					const rawYear = parseInt(dateMatch[3]);
					year = rawYear < 100 ? 2000 + rawYear : rawYear;
				} else if (month < lastMonth) {
					year++;
				}
				lastMonth = month;

				const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
				if (!map.has(key)) map.set(key, new Set());
				map.get(key)!.add(exercise.title);
			}
		}

		return Array.from(map.entries())
			.map(([key, names]) => {
				const [y, m, d] = key.split("-").map(Number);
				return {
					date: new Date(y, m - 1, d),
					dateKey: key,
					exercises: Array.from(names).sort(),
				};
			})
			.sort((a, b) => b.date.getTime() - a.date.getTime());
	};

	onMount(async () => {
		await loadExercises();
		sessions = parseSessions($exercises);
	});

	const fmt = (d: Date) =>
		d.toLocaleDateString("de-DE", {
			weekday: "short",
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
</script>

<main class="px-4 pt-[calc(var(--nav-h,6rem)+1rem)] pb-8 max-w-5xl mx-auto">
	<PageTitle cl="mb-4">Sessions</PageTitle>

	{#if sessions.length === 0}
		<p class="color-fg-alt text-sm">No sessions found.</p>
	{:else}
		<div class="flex flex-col gap-3">
			{#each sessions as session}
				<Card>
					<p class="font-semibold text-lg m-0">{fmt(session.date)}</p>
					<p class="text-xs color-fg-alt mt-1">
						{session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}
					</p>
					<div class="flex flex-wrap gap-2 mt-2">
						{#each session.exercises as name}
							<span class="text-xs px-2 py-1 rounded-md border-solid border-1 border-border-input">
								{name}
							</span>
						{/each}
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</main>

<Nav />
