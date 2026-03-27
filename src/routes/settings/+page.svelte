<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount } from "svelte";
	import { clearExersises, loadDB, type DB } from "../idb";
	import { AlertDialog, Button } from "bits-ui";

	let db: IDBPDatabase<DB>;

	onMount(async () => {
		db = await loadDB();
	});

	const settings = $state({
		import: "",
	});

	const importData = () => {
		const exerciseStings = settings.import.split(/\n{2,}/);
		const exerciseArrays = exerciseStings.map((el) => el.split(/\n/));
		exerciseArrays.forEach((exercise) => {
			const exerciseTitle = exercise[0];
			const workoutsString = exercise.slice(1).join("\n");
			db.add("exercises", {
				title: exerciseTitle,
				workoutsString,
			});
		});
	};

	const logout = async () => {
		const res = await fetch("/settings", {
			method: "POST",
		});
		if (!res.ok) {
			return alert("Failed to log out");
		}
	};
</script>

<main class="px-4">
	<h1 class="font-bold text-xl">Settings</h1>

	<h2 class="font-semibold text-lg mb-2">Import Exercise String</h2>
	<span class="text-fg-alt">Import the Workout String in the jimu Syntax</span>
	<textarea
		class="mt-2 w-full bg-bg rounded-lg border-solid border-2 border-border-input"
		bind:value={settings.import}
	></textarea>
	<Button.Root
		onclick={importData}
		class="w-full mt-3 bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none"
		>Save</Button.Root
	>

	<h2 class="mt-6 font-semibold text-lg">Account</h2>
	<Button.Root
		onclick={logout}
		class="w-full bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none"
		>Logout</Button.Root
	>

	<h2 class="mt-6 font-semibold text-lg">Modify Database</h2>
	<AlertDialog.Root>
		<AlertDialog.Trigger
			class="w-full bg-destructive text-bg rounded-lg p-1.5 text-lg font-semibold border-none"
			>Delete all Exercises</AlertDialog.Trigger
		>
		<AlertDialog.Portal>
			<AlertDialog.Overlay
				class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80"
			/>
			<AlertDialog.Content
				class="rounded-2xl bg-bg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 outline-hidden fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 border-solid border-1 border-border-card p-7 sm:max-w-lg md:w-full"
			>
				<div class="flex flex-col gap-4 pb-6">
					<AlertDialog.Title class="text-lg font-semibold">
						Confirm deletion of Database
					</AlertDialog.Title>
					<AlertDialog.Description class="text-fg-alt text-sm">
						This action cannot be undone.
					</AlertDialog.Description>
				</div>
				<div class="flex w-full items-center justify-center gap-2">
					<AlertDialog.Cancel
						class="rounded-lg bg-muted w-full border-none p-1.5 text-lg font-semibold"
					>
						Cancel
					</AlertDialog.Cancel>
					<AlertDialog.Action
						class="rounded-lg bg-dark text-bg w-full border-none p-1.5 text-lg font-semibold"
						onclick={clearExersises}
					>
						Continue
					</AlertDialog.Action>
				</div>
			</AlertDialog.Content>
		</AlertDialog.Portal>
	</AlertDialog.Root>
</main>
