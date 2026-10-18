<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount, untrack } from "svelte";
	import { clearExersises, loadDB, markExercisesChanged, type DB } from "../idb";
	import { goto } from "$app/navigation";
	import Card from "$lib/ui/Card.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";
	import Popup from "$lib/ui/Popup.svelte";
	import Nav from "../Nav.svelte";
	import H2 from "$lib/ui/H2.svelte";
	import InfoText from "$lib/ui/InfoText.svelte";
	import Input from "$lib/ui/Input.svelte";
	import { toast } from "$lib/toast.svelte";

	let { data } = $props();

	let db: IDBPDatabase<DB>;

	onMount(async () => {
		db = await loadDB();
	});

	const settings = $state({
		import: "",
	});

	let currentUsername = $state(untrack(() => data.username));
	const account = $state({
		username: untrack(() => data.username),
		currentPassword: "",
		newPassword: "",
		confirmNewPassword: "",
	});

	let showDeletePopup = $state(false);
	let showAccountPopup = $state(false);
	let accountSaving = $state(false);

	const importData = async () => {
		const exerciseStings = settings.import.split(/\n{2,}/);
		const exerciseArrays = exerciseStings.map((el) => el.split(/\n/));
		for (const exercise of exerciseArrays) {
			const exerciseTitle = exercise[0];
			const workoutsString = exercise.slice(1).join("\n");
			await db.add("exercises", {
				title: exerciseTitle,
				workoutsString,
			});
		}
		await markExercisesChanged();
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

	const saveAccount = async () => {
		if (!account.currentPassword) {
			return toast.error("Current password is required");
		}
		if (account.newPassword && account.newPassword.length < 8) {
			return toast.error("New password must be at least 8 characters");
		}
		if (account.newPassword !== account.confirmNewPassword) {
			return toast.error("New passwords don't match");
		}
		if (account.username === currentUsername && !account.newPassword) {
			return toast.error("Nothing to update");
		}

		accountSaving = true;
		try {
			const res = await fetch("/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: account.username,
					currentPassword: account.currentPassword,
					newPassword: account.newPassword || undefined,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				return toast.error(body.error ?? "Something went wrong");
			}

			const body = await res.json();
			currentUsername = body.username;
			account.currentPassword = "";
			account.newPassword = "";
			account.confirmNewPassword = "";
			showAccountPopup = false;
			toast.success("Account updated");
		} finally {
			accountSaving = false;
		}
	};
</script>

<main class="pt-[calc(var(--nav-h,6rem)+1rem)] grid grid-cols-1 md:grid-cols-3 gap-4">
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
			<div class="flex items-center justify-between mb-3">
				<div>
					<p class="text-xs uppercase tracking-widest text-fg-alt m-0">Username</p>
					<p class="text-base m-0 mt-1">{currentUsername}</p>
				</div>
			</div>
			<Btn onclick={() => (showAccountPopup = true)} cl="cursor-pointer mb-2">Edit Account</Btn>
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

<Popup title="Edit Account" bind:showPopup={showAccountPopup}>
	<div class="flex flex-col gap-3">
		<div>
			<p class="text-xs uppercase tracking-widest text-fg-alt m-0 mb-1">Username</p>
			<Input bind:value={account.username} placeholder="Username" type="text" />
		</div>
		<div>
			<p class="text-xs uppercase tracking-widest text-fg-alt m-0 mb-1">Current Password</p>
			<Input bind:value={account.currentPassword} placeholder="Current password" type="password" />
		</div>
		<div>
			<p class="text-xs uppercase tracking-widest text-fg-alt m-0 mb-1">New Password</p>
			<Input
				bind:value={account.newPassword}
				placeholder="New password (leave blank to keep)"
				type="password"
			/>
		</div>
		{#if account.newPassword}
			<div>
				<p class="text-xs uppercase tracking-widest text-fg-alt m-0 mb-1">Confirm New Password</p>
				<Input
					bind:value={account.confirmNewPassword}
					placeholder="Confirm new password"
					type="password"
				/>
			</div>
		{/if}
		<div class="flex gap-2 mt-1">
			<Btn
				onclick={() => {
					showAccountPopup = false;
					account.username = currentUsername;
					account.currentPassword = "";
					account.newPassword = "";
					account.confirmNewPassword = "";
				}}
				cl="bg-muted cursor-pointer text-white"
			>
				Cancel
			</Btn>
			<Btn onclick={saveAccount} cl="cursor-pointer" disabled={accountSaving}>
				{accountSaving ? "Saving..." : "Save"}
			</Btn>
		</div>
	</div>
</Popup>

<Nav />
