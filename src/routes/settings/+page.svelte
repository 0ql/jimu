<script lang="ts">
	import type { IDBPDatabase } from "idb";
	import { onMount, untrack } from "svelte";
	import {
		clearExersises,
		EXERCISES_META,
		exercises,
		getSyncMeta,
		loadDB,
		loadExercises,
		markExercisesChanged,
		ROUTINES_META,
		synced,
		syncRoutinesToServer,
		syncToServer,
		type DB,
		type SyncMeta,
	} from "../idb";
	import { goto } from "$app/navigation";
	import Popup from "$lib/ui/Popup.svelte";
	import Nav from "../Nav.svelte";
	import { toast } from "$lib/toast.svelte";

	let { data } = $props();

	let db: IDBPDatabase<DB>;
	let exerciseMeta: SyncMeta | undefined = $state();
	let routineMeta: SyncMeta | undefined = $state();

	const refreshSyncInfo = async () => {
		exerciseMeta = await getSyncMeta(EXERCISES_META);
		routineMeta = await getSyncMeta(ROUTINES_META);
	};

	let ready = $state(false);
	onMount(async () => {
		db = await loadDB();
		await loadExercises();
		ready = true;
	});

	// Re-read the sync bookkeeping whenever the sync state flips (edits, imports, auto-sync).
	$effect(() => {
		void $synced;
		if (ready) refreshSyncInfo();
	});

	let importText = $state("");
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
	let syncing = $state(false);

	/** Import format: exercise name on the first line, its log lines below, a blank line between exercises. */
	const importBlocks = $derived(
		importText
			.split(/\n{2,}/)
			.map((block) => block.split(/\n/))
			.filter((lines) => lines[0]?.trim())
			.map((lines) => ({ title: lines[0].trim(), workoutsString: lines.slice(1).join("\n") })),
	);
	const importLines = $derived(
		importBlocks.reduce(
			(n, b) => n + b.workoutsString.split("\n").filter((l) => l.trim()).length,
			0,
		),
	);

	const importData = async () => {
		if (!importBlocks.length) return;
		for (const block of importBlocks) await db.add("exercises", block);
		await markExercisesChanged();
		await refreshSyncInfo();
		toast.success(
			`Imported ${importBlocks.length} exercise${importBlocks.length === 1 ? "" : "s"}`,
		);
		importText = "";
	};

	const syncNow = async () => {
		syncing = true;
		try {
			await syncToServer();
			await syncRoutinesToServer();
			await refreshSyncInfo();
		} finally {
			syncing = false;
		}
	};

	const deleteAll = async () => {
		await clearExersises();
		await loadExercises();
		await refreshSyncInfo();
		showDeletePopup = false;
		toast.success("All exercises deleted on this device");
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

	const resetAccountForm = () => {
		account.username = currentUsername;
		account.currentPassword = "";
		account.newPassword = "";
		account.confirmNewPassword = "";
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
			resetAccountForm();
			showAccountPopup = false;
			toast.success("Account updated");
		} finally {
			accountSaving = false;
		}
	};

	const versionText = (meta: SyncMeta | undefined) => {
		if (!meta?.lastChanged) return "never synced";
		const when = new Date(meta.lastChanged).toLocaleString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
		return meta.dirty ? `changes waiting · last ${when}` : `up to date · ${when}`;
	};

	const card =
		"flex flex-col rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden";
	const cardHead =
		"m-0 px-4 pt-4 pb-1 font-display font-semibold text-[11px] tracking-[0.08em] uppercase text-subtle";
	const row = "flex items-center gap-3 px-4 py-3.5 min-h-14";
	const divider = "border-t-solid border-t-1 border-t-[#222227]";
	const secondaryBtn =
		"h-10 px-3.5 rounded-[10px] border-none bg-surface-3 cursor-pointer flex items-center gap-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-default";
	const field =
		"h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 text-base outline-none focus:border-signal placeholder:text-[#5a5a62]";
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col gap-5"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<h1 class="m-0 font-display font-semibold text-[30px] leading-none">Settings</h1>

	<div class="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
		<div class="flex flex-col gap-5">
			<section aria-labelledby="account-head" class={card}>
				<h2 id="account-head" class={cardHead}>Account</h2>
				<div class={row}>
					<span
						class="size-10 rounded-full bg-surface-3 flex items-center justify-center font-display font-semibold text-base uppercase shrink-0"
						aria-hidden="true">{currentUsername.slice(0, 1)}</span
					>
					<div class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold truncate">{currentUsername}</span>
						<span class="text-xs text-subtle">Username and password</span>
					</div>
					<button onclick={() => (showAccountPopup = true)} class={secondaryBtn}>
						<i class="i-tabler-pencil block size-4"></i>Edit
					</button>
				</div>
				<div class="{row} {divider}">
					<i class="i-tabler-logout block size-5 text-subtle shrink-0"></i>
					<span class="flex-1">Log out of this device</span>
					<button onclick={logout} class={secondaryBtn}>Log out</button>
				</div>
			</section>

			<section aria-labelledby="sync-head" class={card}>
				<h2 id="sync-head" class={cardHead}>Sync</h2>
				<div class={row}>
					{#if $synced}
						<i class="i-tabler-cloud-check block size-5 text-green-400 shrink-0"></i>
					{:else}
						<i class="i-tabler-cloud-x block size-5 text-destructive shrink-0"></i>
					{/if}
					<div class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold"
							>{$synced ? "Everything synced" : "Changes not synced yet"}</span
						>
						<span class="text-xs text-subtle"
							>Saves sync automatically a few seconds after you type</span
						>
					</div>
					<button onclick={syncNow} disabled={syncing} class={secondaryBtn}>
						<i class="i-tabler-refresh block size-4 {syncing ? 'animate-spin' : ''}"></i>
						{syncing ? "Syncing…" : "Sync now"}
					</button>
				</div>
				<dl class="m-0 {divider} px-4 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
					<dt class="text-subtle">Exercises</dt>
					<dd class="m-0 font-mono text-[13px] text-[#c9c9cf]">
						{$exercises.length} · {versionText(exerciseMeta)}
					</dd>
					<dt class="text-subtle">Routines</dt>
					<dd class="m-0 font-mono text-[13px] text-[#c9c9cf]">{versionText(routineMeta)}</dd>
				</dl>
			</section>

			<section
				aria-labelledby="danger-head"
				class="flex flex-col rounded-2xl bg-surface border-solid border-1 border-[rgba(244,62,92,0.35)] overflow-hidden"
			>
				<h2
					id="danger-head"
					class="m-0 px-4 pt-4 pb-1 font-display font-semibold text-[11px] tracking-[0.08em] uppercase text-[#ff8a8a]"
				>
					Danger zone
				</h2>
				<div class={row}>
					<div class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold">Delete all exercises</span>
						<span class="text-xs text-subtle"
							>Removes every exercise and its log from this device</span
						>
					</div>
					<button
						onclick={() => (showDeletePopup = true)}
						class="h-10 px-3.5 rounded-[10px] border-none bg-[rgba(244,62,92,0.15)] cursor-pointer flex items-center gap-2 text-sm text-[#ff8a8a] shrink-0"
					>
						<i class="i-tabler-trash block size-4 text-[#ff8a8a]"></i>Delete…
					</button>
				</div>
			</section>
		</div>

		<div class="flex flex-col gap-5">
			<section aria-labelledby="import-head" class={card}>
				<h2 id="import-head" class={cardHead}>Import</h2>
				<div class="flex flex-col gap-3 px-4 pt-2 pb-4">
					<label for="import-text" class="text-sm text-subtle">
						Paste exercises: the name on the first line, its log lines below, and a blank line
						between exercises.
					</label>
					<textarea
						id="import-text"
						bind:value={importText}
						spellcheck="false"
						placeholder={"Bizeps Kabel curl\n14.10. a10x12 27.5x10 x9 x7\n18.10. a10x12 30x10 x8 x7 d15x7\n\nBeinpress liegend\n18.10. a60x15 110x12 x12"}
						class="w-full min-h-[9lh] max-h-[24lh] resize-y rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 py-3 font-mono text-sm leading-[1.6] outline-none focus:border-signal placeholder:text-[#5a5a62]"
					></textarea>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<span class="font-mono text-xs text-subtle">
							{#if importBlocks.length}
								{importBlocks.length} exercise{importBlocks.length === 1 ? "" : "s"} · {importLines} log
								line{importLines === 1 ? "" : "s"}
							{:else}
								Nothing to import yet
							{/if}
						</span>
						<button
							onclick={importData}
							disabled={!importBlocks.length}
							class="h-11 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-[#111] disabled:opacity-40 disabled:cursor-default"
						>
							<i class="i-tabler-file-import block size-[18px] text-[#111]"></i>Import
						</button>
					</div>
				</div>
			</section>

			<section aria-labelledby="syntax-head" class={card}>
				<h2 id="syntax-head" class={cardHead}>Log syntax</h2>
				<dl
					class="m-0 px-4 pt-2 pb-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 items-baseline text-sm"
				>
					<dt class="font-mono text-[13px] text-signal">18.10.</dt>
					<dd class="m-0 text-[#c9c9cf]">
						Each line starts with the day. Add a year when you like: 18.10.26 or 18.10.2026
					</dd>
					<dt class="font-mono text-[13px] text-fg">30x10</dt>
					<dd class="m-0 text-[#c9c9cf]">
						A working set: 30 kg for 10 reps. Decimals work: 27.5x10
					</dd>
					<dt class="font-mono text-[13px] text-fg">x8</dt>
					<dd class="m-0 text-[#c9c9cf]">Same weight as the set before, 8 reps</dd>
					<dt class="font-mono text-[13px] text-faint">a10x12</dt>
					<dd class="m-0 text-[#c9c9cf]">Warm-up set, left out of volume</dd>
					<dt class="font-mono text-[13px] text-drop">d15x7</dt>
					<dd class="m-0 text-[#c9c9cf]">Drop set, counted in volume</dd>
				</dl>
			</section>
		</div>
	</div>
</main>

<Popup title="Delete all exercises?" bind:showPopup={showDeletePopup}>
	<div class="flex flex-col gap-4 pt-1">
		<p class="text-sm text-[#c9c9cf]">
			This removes all {$exercises.length} exercises and their logs from this device. A few seconds later
			the automatic sync removes them from the server too, so this can't be undone.
		</p>
		<div class="flex gap-2">
			<button
				onclick={() => (showDeletePopup = false)}
				class="flex-1 h-12 rounded-xl border-none bg-surface-3 cursor-pointer text-[15px] font-semibold"
				>Cancel</button
			>
			<button
				onclick={deleteAll}
				class="flex-1 h-12 rounded-xl border-none bg-destructive cursor-pointer text-[15px] font-semibold text-white"
				>Delete everything</button
			>
		</div>
	</div>
</Popup>

<Popup title="Edit account" bind:showPopup={showAccountPopup}>
	<form
		class="flex flex-col gap-4 pt-1"
		onsubmit={(e) => {
			e.preventDefault();
			saveAccount();
		}}
	>
		<div class="flex flex-col gap-1.5">
			<label for="acc-username" class="text-xs text-subtle">Username</label>
			<input
				id="acc-username"
				bind:value={account.username}
				autocomplete="username"
				class={field}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="acc-current" class="text-xs text-subtle">Current password</label>
			<input
				id="acc-current"
				type="password"
				bind:value={account.currentPassword}
				autocomplete="current-password"
				class={field}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="acc-new" class="text-xs text-subtle">New password</label>
			<input
				id="acc-new"
				type="password"
				bind:value={account.newPassword}
				autocomplete="new-password"
				placeholder="Leave blank to keep"
				class={field}
			/>
		</div>
		{#if account.newPassword}
			<div class="flex flex-col gap-1.5">
				<label for="acc-confirm" class="text-xs text-subtle">Confirm new password</label>
				<input
					id="acc-confirm"
					type="password"
					bind:value={account.confirmNewPassword}
					autocomplete="new-password"
					class={field}
				/>
			</div>
		{/if}
		<div class="flex gap-2 pt-1">
			<button
				type="button"
				onclick={() => {
					showAccountPopup = false;
					resetAccountForm();
				}}
				class="flex-1 h-12 rounded-xl border-none bg-surface-3 cursor-pointer text-[15px] font-semibold"
				>Cancel</button
			>
			<button
				type="submit"
				disabled={accountSaving}
				class="flex-1 h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-[#111] disabled:opacity-50"
				>{accountSaving ? "Saving…" : "Save"}</button
			>
		</div>
	</form>
</Popup>

<Nav />
