<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount } from "svelte";
	import { clearExersises, loadDB, type DB } from "../idb";
	import { AlertDialog } from "bits-ui";
	import { goto } from "$app/navigation";
	import Card from "$lib/ui/Card.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import Nav from "../Nav.svelte";

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
		goto("/login");
	};
</script>

<main class="px-4 pt-24 pb-8 max-w-lg mx-auto flex flex-col gap-4">
	<h1 class="text-3xl font-black uppercase tracking-widest m-0">Settings</h1>

	<Card>
		<p class="text-xs uppercase tracking-widest text-fg-alt mb-3 m-0">Import</p>
		<p class="text-sm text-fg-alt mb-3 m-0">Import exercises using the jimu syntax</p>
		<textarea
			class="w-full bg-bg rounded-lg border-solid border-1 border-border-input px-4 py-3 outline-none text-sm"
			placeholder="Paste exercise string here..."
			bind:value={settings.import}
		></textarea>
		<Btn onclick={importData} cl="cursor-pointer">Save</Btn>
	</Card>

	<Card>
		<p class="text-xs uppercase tracking-widest text-fg-alt mb-3 m-0">Account</p>
		<Btn onclick={logout} cl="bg-muted cursor-pointer mt-0">Logout</Btn>
	</Card>

	<Card>
		<p class="text-xs uppercase tracking-widest text-destructive mb-3 m-0">Danger Zone</p>
		<AlertDialog.Root>
			<AlertDialog.Trigger
				class="w-full bg-destructive rounded-lg py-2.5 text-sm font-bold uppercase tracking-widest border-none cursor-pointer"
				style="color: #fff;"
			>
				Delete all Exercises
			</AlertDialog.Trigger>
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
							This action cannot be undone. By continuing you are deleting the
							local database of exercises. Only by pressing the sync button
							afterwards will the server version be overridden.
						</AlertDialog.Description>
					</div>
					<div class="flex w-full items-center justify-center gap-2">
						<AlertDialog.Cancel
							class="rounded-lg bg-muted w-full border-none py-2.5 text-sm font-bold uppercase tracking-widest cursor-pointer"
						>
							Cancel
						</AlertDialog.Cancel>
						<AlertDialog.Action
							class="rounded-lg bg-dark text-bg w-full border-none py-2.5 text-sm font-bold uppercase tracking-widest cursor-pointer"
							onclick={clearExersises}
						>
							Continue
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	</Card>
</main>

<Nav />
