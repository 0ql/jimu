<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount } from "svelte";
	import { loadDB, type DB } from "../db";

	let db: IDBPDatabase<DB>;

	onMount(async () => {
		db = await loadDB();
	});

	const settings = {
		import: "",
	};

	const clearObjectStore = () => {
		db.clear("exercises");
	};

	// const importData = () => {
	// 	const exerciseStings = settings.import.split(/\n{2,}/);
	// 	const exerciseArrays = exerciseStings.map((el) => el.split(/\n/));
	// 	exerciseArrays.forEach((exercise) => {
	// 		const exerciseTitle = exercise[0];
	// 		const workoutsString = exercise.slice(1).join("\n");
	// 		db.add("exercises", {
	// 			title: exerciseTitle,
	// 			workoutsString,
	// 		});
	// 	});
	// };
</script>

<h1>Import</h1>
<textarea class="w-full" bind:value={settings.import}></textarea>
<!-- <button onclick={importData}>Save</button> -->
