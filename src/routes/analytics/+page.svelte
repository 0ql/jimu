<script lang="ts">
	import { LayerCake, Svg } from "layercake";
	import { scaleTime } from "d3-scale";
	import Scatter from "./_components/Scatter.svg.svelte";
	import AxisX from "./_components/AxisX.svelte";
	import AxisY from "./_components/AxisY.svelte";
	import { exercises, loadExercises } from "../idb";
	import { onMount } from "svelte";
	import { type Exercise } from "../idb";
	import Nav from "../Nav.svelte";
	import Card from "$lib/ui/Card.svelte";

	let selection: number;
	let selectedExercise: Exercise | null = $state(null);

	onMount(async () => {
		await loadExercises();
	});

	let points: any = $state([]);

	const START_YEAR = 2023;

	const parseWorkoutData = (rawStrings: string[]) => {
		let year = START_YEAR;
		let lastMonth = 0;
		return rawStrings
			.map((row) => {
				const dateMatch = row.match(/^(\d{1,2})\.(\d{1,2})\.(?:(\d{2,4})\.)?/);
				if (!dateMatch) return null;

				const day = parseInt(dateMatch[1]);
				const month = parseInt(dateMatch[2]);

				if (dateMatch[3] !== undefined) {
					const rawYear = parseInt(dateMatch[3]);
					year = rawYear < 100 ? 2000 + rawYear : rawYear;
				} else if (month < lastMonth) {
					year++;
				}
				lastMonth = month;

				const setRegex = /(\d+(?:\.\d+)?)\s*x\s*(\d+)/g;

				let match;
				let totalVolume = 0;
				let maxWeight = 0;
				let totalReps = 0;

				while ((match = setRegex.exec(row)) !== null) {
					const weight = parseFloat(match[1]);
					const reps = parseInt(match[2]);

					totalVolume += weight * reps;
					totalReps += reps;
					if (weight > maxWeight) maxWeight = weight;
				}

				if (totalVolume === 0) return null;

				return {
					x: new Date(year, month - 1, day),
					y: totalVolume,
					maxWeight,
					totalReps,
					rawText: row,
				};
			})
			.filter(Boolean);
	};

	const showExercise = () => {
		selectedExercise = $exercises.filter(
			(exercise) => exercise.id === selection,
		)[0];
		const cleanData = parseWorkoutData(
			selectedExercise.workoutsString.split("\n"),
		);
		points = cleanData;
	};

	let yAxisField = $state("y");
</script>

<main class="p-4">
	<div class="mt-36">
		<Card label="Exercise">
			<select
				class="w-full bg-transparent outline-none text-base"
				bind:value={selection}
				onchange={showExercise}
			>
				{#each $exercises as exercise}
					<option class="bg-bg" value={exercise.id}>{exercise.title}</option>
				{/each}
			</select>
		</Card>

		<Card label="Metric" cl="mt-4">
			<select
				class="w-full bg-transparent outline-none text-base"
				bind:value={yAxisField}
				onchange={showExercise}
			>
				<option class="bg-bg" value="y">Volume</option>
				<option class="bg-bg" value="maxWeight">Max Weight</option>
				<option class="bg-bg" value="totalReps">Total Reps</option>
			</select>
		</Card>

		<Card cl="mt-4 h-64 p-8">
			<LayerCake
				x="x"
				y={yAxisField}
				data={points}
				xScale={scaleTime()}
				padding={{ left: 40, bottom: 20 }}
			>
				<Svg>
					<Scatter fill={"white"} r={3} />
					<AxisX
						ticks={5}
						format={(d) =>
							d instanceof Date
								? d.toLocaleDateString("de-DE", {
										month: "short",
										year: "2-digit",
									})
								: String(d)}
					/>
					<AxisY />
				</Svg>
			</LayerCake>
		</Card>

		{#if selectedExercise}
			<Card cl="mt-4">
				<details>
					<summary
						class="py-1 cursor-pointer text-sm font-semibold list-none color-fg-alt"
					>
						Raw data
					</summary>
					<p class="text-sm mt-2 leading-relaxed">
						{@html selectedExercise.workoutsString.replaceAll("\n", "<br>")}
					</p>
				</details>
			</Card>
		{/if}
	</div>
</main>

<Nav />
