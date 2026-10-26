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
		syncAndClearLocalData,
		syncRoutinesToServer,
		syncToServer,
		type DB,
		type SyncMeta,
	} from "../idb";
	import { goto, invalidateAll } from "$app/navigation";
	import Popup from "#lib/ui/Popup.svelte";
	import Nav from "../Nav.svelte";
	import { toast } from "#lib/toast.svelte.js";
	import { forgetOfflineCache, online } from "#lib/network.js";
	import { newId } from "#lib/merge.js";
	import {
		HAPTIC_STRENGTHS,
		hapticStrength,
		hapticsEnabled,
		hapticsSupported,
		previewHaptic,
		type HapticStrength,
	} from "#lib/haptics.js";
	import { theme, THEMES } from "#lib/theme.js";
	import { setLetters } from "#lib/setLetters.js";
	import { unit } from "#lib/unit.js";
	import { DEFAULT_LETTERS, validLetter } from "#lib/sets.js";

	let { data } = $props();

	// What happened on the last strength tap, so a phone that stays silent can be diagnosed:
	// the browser either refuses the buzz (fixable in the app) or hands it to the phone (then the
	// phone's own settings are dropping it).
	let vibrationTest: {
		ms: number;
		result: boolean | null;
		tapped: boolean;
		secure: boolean;
	} | null = $state(null);
	const testVibration = (ms: number) => {
		vibrationTest = {
			ms,
			result: previewHaptic(ms),
			tapped: navigator.userActivation?.hasBeenActive ?? true,
			secure: window.isSecureContext,
		};
	};

	// Connected apps (the Claude connector). Disconnecting takes two taps, like role changes in Admin.
	let revokePending: string | null = $state(null);
	const revoke = async (id: string) => {
		if (revokePending !== id) {
			revokePending = id;
			return;
		}
		const res = await fetch("/settings/connections", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id }),
		}).catch(() => null);
		revokePending = null;
		if (!res?.ok) {
			toast.error(
				res ? "Couldn't disconnect the app" : "You're offline. Disconnecting needs a connection.",
			);
			return;
		}
		toast.success("Disconnected. The app can no longer reach your data.");
		await invalidateAll();
	};
	const copyConnectorUrl = async () => {
		try {
			await navigator.clipboard.writeText(data.connectorUrl);
			toast.success("Address copied");
		} catch {
			toast.error("Couldn't copy. Select the address instead.");
		}
	};
	const connectedOn = (ms: number) =>
		new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
	const usedAgo = (ms: number | null) => {
		if (ms === null) return "not used yet";
		const days = Math.floor((Date.now() - ms) / 86_400_000);
		return days <= 0 ? "used today" : days === 1 ? "used yesterday" : `used ${days}d ago`;
	};

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
		for (const block of importBlocks) await db.add("exercises", { ...block, id: newId() });
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

	// Why logging out didn't happen, shown under the Log out row.
	const LOGOUT_PROBLEMS = {
		offline: {
			title: "You're offline",
			text: "Logging out first saves your latest training to your account, so it needs a connection. Try again once you're back online.",
		},
		unsynced: {
			title: "Your changes couldn't be saved",
			text: "Some training on this device isn't in your account yet, so you're still logged in. Try again in a moment.",
		},
		server: {
			title: "Couldn't log out",
			text: "The server didn't answer. Try again in a moment.",
		},
	};
	let logoutProblem: keyof typeof LOGOUT_PROBLEMS | null = $state(null);
	let loggingOut = $state(false);
	// The offline note goes away by itself once the connection is back.
	$effect(() => {
		if ($online && logoutProblem === "offline") logoutProblem = null;
	});

	const logout = async () => {
		logoutProblem = null;
		// Checked first: going ahead offline would clear this device and then fail to log out.
		if (!$online) {
			logoutProblem = "offline";
			return;
		}
		loggingOut = true;
		try {
			// Upload pending edits while still signed in, then leave nothing behind for the next account.
			if (!(await syncAndClearLocalData())) {
				logoutProblem = $online ? "unsynced" : "offline";
				return;
			}
			const res = await fetch("/settings", {
				method: "POST",
			}).catch(() => null);
			if (!res?.ok) {
				logoutProblem = "server";
				return;
			}
			forgetOfflineCache();
			goto("/login", { invalidateAll: true });
		} finally {
			loggingOut = false;
		}
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
			}).catch(() => null);

			if (!res) return toast.error("You're offline. Account changes need a connection.");
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

	// The unit belongs to the account, so it needs the server; offline it says so.
	let unitProblem: string | null = $state(null);
	let savingUnit = $state(false);
	const setUnit = async (next: "kg" | "lb") => {
		if (next === unit()) return;
		unitProblem = null;
		savingUnit = true;
		try {
			const res = await fetch("/settings/unit", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ unit: next }),
			}).catch(() => null);
			if (!res?.ok) {
				unitProblem = res
					? "Couldn't save the unit. Try again."
					: "Changing the unit needs a connection.";
				return;
			}
			await invalidateAll();
		} finally {
			savingUnit = false;
		}
	};

	// The warm-up and drop letters: a valid pair is used right away, anything else is explained
	// and not saved.
	let lettersProblem: string | null = $state(null);
	const setLetter = (kind: "warmup" | "drop", input: HTMLInputElement) => {
		const letter = input.value.trim().toLowerCase();
		input.value = letter;
		const next = { ...$setLetters, [kind]: letter };
		if (!letter) lettersProblem = "Pick a letter for both.";
		else if (!validLetter(letter))
			lettersProblem = "Use a letter other than x (x separates weight and reps).";
		else if (next.warmup === next.drop)
			lettersProblem = "Warm-up and drop sets need different letters.";
		else {
			lettersProblem = null;
			$setLetters = next;
		}
	};
	const resetLetters = () => {
		lettersProblem = null;
		$setLetters = DEFAULT_LETTERS;
	};
	const divider = "border-t-solid border-t-1 border-t-divider";
	const secondaryBtn =
		"h-10 px-3.5 rounded-[10px] border-none bg-surface-3 cursor-pointer flex items-center gap-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-default";
	const field =
		"h-[50px] w-full rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 text-base outline-none focus:border-signal-ink placeholder:text-placeholder";
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col gap-5"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<h1 class="sr-only">Settings</h1>

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
				{#if data.isAdmin}
					<a href="/admin" class="{row} {divider} no-underline">
						<i class="i-tabler-shield-half block size-5 text-subtle shrink-0"></i>
						<div class="flex-1 min-w-0 flex flex-col">
							<span>Admin</span>
							<span class="text-xs text-subtle">Users, roles and app stats</span>
						</div>
						<i class="i-tabler-chevron-right block size-[18px] text-faint shrink-0"></i>
					</a>
				{/if}
				<div class="{row} {divider}">
					<i class="i-tabler-logout block size-5 text-subtle shrink-0"></i>
					<span class="flex-1">Log out of this device</span>
					<button onclick={logout} disabled={loggingOut} class={secondaryBtn}>
						{loggingOut ? "Logging out…" : "Log out"}
					</button>
				</div>
				{#if logoutProblem}
					{@const problem = LOGOUT_PROBLEMS[logoutProblem]}
					<!-- Colors are set on each part because main.css gives every element the foreground color. -->
					<div
						role="alert"
						class="mx-4 mb-4 -mt-1 flex gap-3 p-3.5 rounded-xl bg-[var(--warn-bg)] border-solid border-1 border-[var(--warn-edge)]"
					>
						<i
							class="{logoutProblem === 'offline'
								? 'i-tabler-cloud-off'
								: 'i-tabler-alert-circle'} block size-5 shrink-0 mt-px text-[var(--warn)]"
						></i>
						<div class="flex-1 min-w-0 flex flex-col gap-1">
							<span class="text-sm font-semibold text-[var(--warn)]">{problem.title}</span>
							<span class="text-[13px] leading-snug text-[var(--warn)]">{problem.text}</span>
						</div>
						<button
							onclick={() => (logoutProblem = null)}
							aria-label="Dismiss"
							class="size-7 -mr-1 -mt-1 shrink-0 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
						>
							<i class="i-tabler-x block size-4 text-[var(--warn)]"></i>
						</button>
					</div>
				{/if}
			</section>

			<section aria-labelledby="apps-head" class={card}>
				<h2 id="apps-head" class={cardHead}>Connected apps</h2>
				{#each data.connections as app (app.id)}
					{@const armed = revokePending === app.id}
					<div class={row}>
						<i class="i-tabler-plug-connected block size-5 text-subtle shrink-0"></i>
						<div class="flex-1 min-w-0 flex flex-col">
							<span class="font-semibold truncate">{app.name}</span>
							<span class="text-xs text-subtle">
								{app.host} · {app.canWrite ? "can make changes" : "read only"} · since {connectedOn(
									app.createdAt,
								)} · {usedAgo(app.lastUsedAt)}
							</span>
						</div>
						<button
							onclick={() => revoke(app.id)}
							class="h-10 px-3.5 rounded-[10px] border-none cursor-pointer text-sm shrink-0 {armed
								? 'bg-destructive text-white font-semibold'
								: 'bg-surface-3'}">{armed ? "Disconnect" : "Revoke"}</button
						>
						{#if armed}
							<button
								onclick={() => (revokePending = null)}
								aria-label="Cancel"
								class="size-10 -ml-2 shrink-0 rounded-[10px] border-none bg-transparent cursor-pointer flex items-center justify-center"
							>
								<i class="i-tabler-x block size-4 text-subtle"></i>
							</button>
						{/if}
					</div>
				{/each}
				<div class="{row} {data.connections.length ? divider : ''} items-start">
					<i class="i-tabler-sparkles block size-5 text-subtle shrink-0 mt-0.5"></i>
					<div class="flex-1 min-w-0 flex flex-col gap-1.5">
						<span class="text-sm">
							{data.connections.length
								? "Connect another assistant"
								: "Let an AI assistant read your training"}: add this address as a custom connector
							in Claude or ChatGPT
						</span>
						<code class="font-mono text-xs text-soft break-all">{data.connectorUrl}</code>
					</div>
					<button onclick={copyConnectorUrl} class={secondaryBtn}>
						<i class="i-tabler-copy block size-4"></i>Copy
					</button>
				</div>
			</section>

			<section aria-labelledby="sync-head" class={card}>
				<h2 id="sync-head" class={cardHead}>Sync</h2>
				<div class={row}>
					{#if $synced}
						<i class="i-tabler-cloud-check block size-5 text-ok shrink-0"></i>
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
					<dd class="m-0 font-mono text-[13px] text-soft">
						{$exercises.length} · {versionText(exerciseMeta)}
					</dd>
					<dt class="text-subtle">Routines</dt>
					<dd class="m-0 font-mono text-[13px] text-soft">{versionText(routineMeta)}</dd>
				</dl>
			</section>

			<section aria-labelledby="appearance-head" class={card}>
				<h2 id="appearance-head" class={cardHead}>Appearance</h2>
				<div
					class="{row} border-b-solid border-b-1 border-b-divider-2"
					role="group"
					aria-labelledby="unit-label"
				>
					<i class="i-tabler-weight block size-5 text-subtle shrink-0"></i>
					<span id="unit-label" class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold">Unit</span>
						<span class="text-xs {unitProblem ? 'text-danger' : 'text-subtle'}"
							>{unitProblem ??
								"For your account. Only the label: logged numbers stay as they are"}</span
						>
					</span>
					<div
						class="flex gap-1 p-1 rounded-xl bg-bg border-solid border-1 border-hairline shrink-0"
					>
						{#each ["kg", "lb"] as const as option}
							<button
								onclick={() => setUnit(option)}
								aria-pressed={unit() === option}
								disabled={savingUnit}
								class="h-8 px-3 rounded-lg border-none cursor-pointer text-[13px] font-semibold {unit() ===
								option
									? 'bg-dark text-bg'
									: 'bg-transparent text-soft'}">{option}</button
							>
						{/each}
					</div>
				</div>
				<div class={row} role="group" aria-labelledby="theme-label">
					<i class="i-tabler-palette block size-5 text-subtle shrink-0"></i>
					<span id="theme-label" class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold">Theme</span>
						<span class="text-xs text-subtle">On this device</span>
					</span>
					<div
						class="flex gap-1 p-1 rounded-xl bg-bg border-solid border-1 border-hairline shrink-0"
					>
						{#each THEMES as option}
							<button
								onclick={() => ($theme = option)}
								aria-pressed={$theme === option}
								class="h-8 px-2.5 rounded-lg border-none cursor-pointer text-[13px] font-semibold capitalize {$theme ===
								option
									? 'bg-dark text-bg'
									: 'bg-transparent text-soft'}">{option}</button
							>
						{/each}
					</div>
				</div>
			</section>

			<section aria-labelledby="keypad-head" class={card}>
				<h2 id="keypad-head" class={cardHead}>Keypad</h2>
				<label class="{row} cursor-pointer {hapticsSupported ? '' : 'opacity-60 cursor-default'}">
					<i class="i-tabler-device-mobile-vibration block size-5 text-subtle shrink-0"></i>
					<span class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold">Vibrate on key press</span>
						<span class="text-xs text-subtle">
							{hapticsSupported
								? "A short buzz on every keypad tap, on this device"
								: "This browser can't vibrate (iPhones don't support it)"}
						</span>
					</span>
					<!-- Native checkbox styled as a switch, so it keeps keyboard and screen reader support. -->
					<input
						type="checkbox"
						role="switch"
						bind:checked={$hapticsEnabled}
						onchange={(e) => e.currentTarget.checked && previewHaptic()}
						disabled={!hapticsSupported}
						class="appearance-none m-0 shrink-0 w-11 h-6.5 rounded-full bg-track relative cursor-pointer transition-colors checked:bg-signal disabled:cursor-default
							before:content-[''] before:absolute before:top-[3px] before:left-[3px] before:size-5 before:rounded-full before:bg-fg before:transition-transform checked:before:translate-x-[18px] checked:before:bg-on-signal"
					/>
				</label>
				<div
					class="{row} {divider} {hapticsSupported && $hapticsEnabled ? '' : 'opacity-50'}"
					role="group"
					aria-labelledby="strength-label"
				>
					<span id="strength-label" class="flex-1 min-w-0 flex flex-col">
						<span class="font-semibold">Strength</span>
						<span class="text-xs text-subtle"
							>Tap to feel it. Nothing at all? Check silent mode.</span
						>
					</span>
					<div
						class="flex gap-1 p-1 rounded-xl bg-bg border-solid border-1 border-hairline shrink-0"
					>
						{#each Object.keys(HAPTIC_STRENGTHS) as HapticStrength[] as strength}
							<button
								onclick={() => {
									$hapticStrength = strength;
									testVibration(HAPTIC_STRENGTHS[strength]);
								}}
								disabled={!hapticsSupported || !$hapticsEnabled}
								aria-pressed={$hapticStrength === strength}
								class="h-8 px-2.5 rounded-lg border-none cursor-pointer text-[13px] font-semibold capitalize disabled:cursor-default {$hapticStrength ===
								strength
									? 'bg-dark text-bg'
									: 'bg-transparent text-soft'}">{strength}</button
							>
						{/each}
					</div>
				</div>
				{#if vibrationTest}
					<p
						role="status"
						class="m-0 px-4 pb-3.5 -mt-1 text-xs leading-relaxed {vibrationTest.result
							? 'text-subtle'
							: 'text-danger'}"
					>
						{#if vibrationTest.result === true}
							The browser accepted a {vibrationTest.ms} ms buzz. Felt nothing? Then the phone is dropping
							it: check silent / Do Not Disturb, battery saver, and vibration or touch feedback under
							Sound &amp; vibration.
						{:else if vibrationTest.result === false}
							The browser refused the buzz{vibrationTest.tapped ? "" : " (no tap on the page yet)"}.
						{:else}
							This browser doesn't support vibration.
						{/if}
						<span class="block font-mono text-faint mt-1">
							vibrate({vibrationTest.ms}) → {String(vibrationTest.result)} · tapped: {vibrationTest.tapped
								? "yes"
								: "no"} · secure: {vibrationTest.secure ? "yes" : "no"}
						</span>
					</p>
				{/if}
				<div
					class="{row} flex-wrap border-t-solid border-t-1 border-t-divider-2"
					role="group"
					aria-labelledby="letters-label"
				>
					<i class="i-tabler-letter-case block size-5 text-subtle shrink-0"></i>
					<span id="letters-label" class="flex-1 min-w-40 flex flex-col">
						<span class="font-semibold">Set letters</span>
						<span class="text-xs {lettersProblem ? 'text-danger' : 'text-subtle'}">
							{lettersProblem ??
								`What you type before a warm-up or drop set, on this device. Logs stay readable everywhere.`}
						</span>
					</span>
					<div class="flex items-center gap-3 shrink-0">
						{#each [["warmup", "Warm-up"], ["drop", "Drop"]] as const as [kind, label]}
							<label class="flex items-center gap-1.5 text-[13px] text-subtle">
								{label}
								<input
									value={$setLetters[kind]}
									oninput={(e) => setLetter(kind, e.currentTarget)}
									maxlength="1"
									autocomplete="off"
									autocapitalize="off"
									spellcheck="false"
									aria-label="{label} letter"
									class="w-10 h-10 rounded-[10px] border-solid border-1 text-center font-mono text-base bg-bg outline-none focus:border-signal-ink {lettersProblem
										? 'border-destructive'
										: 'border-edge-2'}"
								/>
							</label>
						{/each}
						{#if $setLetters.warmup !== "a" || $setLetters.drop !== "d"}
							<button
								onclick={resetLetters}
								class="h-8 px-2.5 rounded-lg border-none bg-surface-3 cursor-pointer text-[13px]"
								>Reset</button
							>
						{/if}
					</div>
				</div>
			</section>

			<section
				aria-labelledby="danger-head"
				class="flex flex-col rounded-2xl bg-surface border-solid border-1 border-[rgba(244,62,92,0.35)] overflow-hidden"
			>
				<h2
					id="danger-head"
					class="m-0 px-4 pt-4 pb-1 font-display font-semibold text-[11px] tracking-[0.08em] uppercase text-danger"
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
						class="h-10 px-3.5 rounded-[10px] border-none bg-[rgba(244,62,92,0.15)] cursor-pointer flex items-center gap-2 text-sm text-danger shrink-0"
					>
						<i class="i-tabler-trash block size-4 text-danger"></i>Delete…
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
						class="w-full min-h-[9lh] max-h-[24lh] resize-y rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 py-3 font-mono text-sm leading-[1.6] outline-none focus:border-signal-ink placeholder:text-placeholder"
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
							class="h-11 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-on-signal disabled:opacity-40 disabled:cursor-default"
						>
							<i class="i-tabler-file-import block size-[18px] text-on-signal"></i>Import
						</button>
					</div>
				</div>
			</section>

			<section aria-labelledby="syntax-head" class={card}>
				<h2 id="syntax-head" class={cardHead}>Log syntax</h2>
				<dl
					class="m-0 px-4 pt-2 pb-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 items-baseline text-sm"
				>
					<dt class="font-mono text-[13px] text-signal-ink">18.10.</dt>
					<dd class="m-0 text-soft">
						Each line starts with the day. Add a year when you like: 18.10.26 or 18.10.2026
					</dd>
					<dt class="font-mono text-[13px] text-fg">30x10</dt>
					<dd class="m-0 text-soft">
						A working set: 30 {unit()} for 10 reps. Decimals work: 27.5x10
					</dd>
					<dt class="font-mono text-[13px] text-fg">x8</dt>
					<dd class="m-0 text-soft">Same weight as the set before, 8 reps</dd>
					<dt class="font-mono text-[13px] text-faint">{$setLetters.warmup}10x12</dt>
					<dd class="m-0 text-soft">Warm-up set, left out of volume</dd>
					<dt class="font-mono text-[13px] text-drop">{$setLetters.drop}15x7</dt>
					<dd class="m-0 text-soft">Drop set, counted in volume</dd>
					<dt class="font-mono text-[13px] text-fg">x20</dt>
					<dd class="m-0 text-soft">No weight at all: bodyweight, 20 reps</dd>
					<dt class="font-mono text-[13px] text-fg">+10x8</dt>
					<dd class="m-0 text-soft">
						Bodyweight plus 10 {unit()} (a dip belt). Only the added weight counts in volume
					</dd>
					<dt class="font-mono text-[13px] text-fg">-20x8</dt>
					<dd class="m-0 text-soft">
						Bodyweight with 20 {unit()} of assistance, e.g. machine pull-ups
					</dd>
					<dt class="font-mono text-[13px] text-fg">20x12/11</dt>
					<dd class="m-0 text-soft">
						One side at a time: 12 reps on the side you start with, 11 on the other. Both count
					</dd>
				</dl>
			</section>
		</div>
	</div>
</main>

<Popup title="Delete all exercises?" bind:showPopup={showDeletePopup}>
	<div class="flex flex-col gap-4 pt-1">
		<p class="text-sm text-soft">
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
				class="flex-1 h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-on-signal disabled:opacity-50"
				>{accountSaving ? "Saving…" : "Save"}</button
			>
		</div>
	</form>
</Popup>

<Nav />
