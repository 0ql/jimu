<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount } from "svelte";
	import { clearExersises, loadDB, type DB } from "../idb";
	import { goto } from "$app/navigation";
	import Card from "$lib/ui/Card.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import Nav from "../Nav.svelte";
	import H2 from "$lib/ui/H2.svelte";
	import InfoText from "$lib/ui/InfoText.svelte";

	let db: IDBPDatabase<DB>;

	onMount(async () => {
		db = await loadDB();
	});

	const settings = $state({
		import: "",
	});

	let showDeletePopup = $state(false);

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

<main class="pt-24 grid grid-cols-1 md:grid-cols-3 gap-4">
	<PageTitle cl="mb-3 col-span-full">Settings</PageTitle>

	<Card cl="md:col-span-2">
		<H2>Import</H2>
		<InfoText cl="mb-2">Import exercises using the jimu syntax</InfoText>
		<textarea
			class="w-full bg-bg rounded-lg border-solid border-1 border-border-input px-4 py-3 outline-none text-sm mb-2"
			placeholder="Paste exercise string here..."
			bind:value={settings.import}
		></textarea>
		<Btn onclick={importData} cl="cursor-pointer">Save</Btn>
	</Card>

	<div class="flex flex-col gap-4">
		<Card>
			<H2>Account</H2>
			<Btn onclick={logout} cl="bg-muted cursor-pointer mt-0 text-white">Logout</Btn>
		</Card>

		<Card>
			<p class="text-xs uppercase tracking-widest text-destructive mb-2">Danger Zone</p>
			<Btn
				onclick={() => (showDeletePopup = true)}
				cl="bg-destructive cursor-pointer"
				style="color: #fff;"
			>
				Delete all Exercises
			</Btn>
		</Card>
	</div>
</main>

<Popup title="Confirm Deletion" bind:showPopup={showDeletePopup}>
	<p class="text-fg-alt text-sm mt-0">
		This action cannot be undone. You are deleting the local database of exercises. Only by pressing
		the sync button afterwards will the server version be overridden.
	</p>
	<div class="flex gap-2">
		<Btn onclick={() => (showDeletePopup = false)} cl="bg-muted cursor-pointer text-white"
			>Cancel</Btn
		>
		<Btn
			onclick={() => {
				clearExersises();
				showDeletePopup = false;
			}}
			cl="bg-destructive cursor-pointer"
			style="color: #fff;"
		>
			Delete
		</Btn>
	</div>
</Popup>

<Nav />
