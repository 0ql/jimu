<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { formatKg } from "#lib/sets.js";
	import { toast } from "#lib/toast.svelte.js";
	import Nav from "../Nav.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// Role changes take two clicks: the first arms the button, the second sends it.
	let pending: string | null = $state(null);
	let busy = $state(false);

	const changeRole = async (username: string, makeAdmin: boolean) => {
		if (pending !== username) {
			pending = username;
			return;
		}
		busy = true;
		try {
			const res = await fetch("/admin", {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({ username, isAdmin: makeAdmin }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast.error(body.message ?? "Couldn't change the role");
				return;
			}
			toast.success(
				makeAdmin ? `${username} is now an admin` : `${username} is no longer an admin`,
			);
			await invalidateAll();
		} finally {
			busy = false;
			pending = null;
		}
	};

	const DAY = 86_400_000;
	const ago = (ms: number | null) => {
		if (ms === null) return "—";
		const days = Math.floor((data.generatedAt - ms) / DAY);
		return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
	};
	const date = (ms: number | null) =>
		ms === null
			? "—"
			: new Date(ms).toLocaleDateString("de-DE", {
					day: "2-digit",
					month: "2-digit",
					year: "2-digit",
				});
	const bytes = (n: number | null) =>
		n === null
			? "—"
			: n < 1024 * 1024
				? `${Math.round(n / 1024)} KB`
				: `${(n / 1024 / 1024).toFixed(1)} MB`;
	const compact = (n: number) =>
		n >= 1_000_000
			? `${(n / 1_000_000).toFixed(1)} M`
			: n >= 10_000
				? `${Math.round(n / 1000)} K`
				: formatKg(n);

	const t = $derived(data.totals);
	const tiles = $derived([
		{
			label: "Users",
			value: String(t.users),
			note: `${t.newUsers30d} new in 30 days · ${t.admins} admin${t.admins === 1 ? "" : "s"}`,
		},
		{ label: "Active", value: String(t.active7d), note: `synced in 7 days · ${t.active30d} in 30` },
		{
			label: "Training days",
			value: compact(t.trainingDays),
			note: `${compact(t.sets)} sets logged`,
		},
		{
			label: "Volume lifted",
			value: t.volume >= 10_000 ? `${formatKg(t.volume / 1000)} t` : `${formatKg(t.volume)} kg`,
			note: "warm-ups excluded",
		},
		{ label: "Content", value: String(t.exercises), note: `exercises · ${t.routines} routines` },
		{
			label: "Sessions",
			value: String(t.activeSessions),
			note: `signed in · database ${bytes(t.databaseBytes)}`,
		},
	]);

	const maxWeek = $derived(Math.max(1, ...data.weekly.map((w) => w.days)));
	const weekLabel = (start: number) =>
		new Date(start).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
	const thisWeek = $derived(data.weekly.at(-1)?.days ?? 0);
</script>

<main
	class="lg:max-w-[1408px] lg:mx-auto lg:px-4 pb-10 flex flex-col gap-5"
	style="padding-top: calc(var(--nav-h, 6rem) + 1.25rem)"
>
	<div class="flex flex-col gap-0.5">
		<h1 class="m-0 font-display font-semibold text-[30px] leading-none">Admin</h1>
		<span class="text-sm text-subtle">
			Everyone on this server · as of {new Date(data.generatedAt).toLocaleString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			})}
		</span>
	</div>

	<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
		{#each tiles as tile}
			<div
				class="flex flex-col gap-0.5 px-3.5 py-3 rounded-xl bg-surface border-solid border-1 border-hairline min-w-0"
			>
				<span class="text-xs text-subtle">{tile.label}</span>
				<span
					class="font-display font-semibold text-[22px] leading-[1.2] whitespace-nowrap truncate"
					>{tile.value}</span
				>
				<span class="text-xs text-faint truncate">{tile.note}</span>
			</div>
		{/each}
	</div>

	<section
		aria-labelledby="weekly-head"
		class="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-surface border-solid border-1 border-hairline"
	>
		<div class="flex flex-wrap justify-between items-baseline gap-x-3">
			<h2 id="weekly-head" class="m-0 text-[15px] font-semibold">Training days per week</h2>
			<span class="text-xs text-subtle"
				>all users · last {data.weekly.length} weeks · {thisWeek} this week</span
			>
		</div>
		<div
			role="img"
			aria-label="Training days per week, oldest first: {data.weekly
				.map((w) => `${weekLabel(w.start)} ${w.days}`)
				.join(', ')}"
			class="h-[160px] flex items-end gap-1.5"
		>
			{#each data.weekly as week, i}
				{@const latest = i === data.weekly.length - 1}
				<div
					class="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1"
					title="Week of {weekLabel(week.start)}: {week.days} training day{week.days === 1
						? ''
						: 's'}"
				>
					<span class="font-mono text-[10px] {latest ? 'text-fg' : 'text-dim'}"
						>{week.days || ""}</span
					>
					<div
						class="w-full max-w-6 rounded-t-[4px] {latest ? 'bg-signal' : 'bg-track'}"
						style="height: {week.days ? Math.max(4, Math.round((week.days / maxWeek) * 120)) : 2}px"
					></div>
					<span
						class="font-mono text-[10px] text-dim {(data.weekly.length - 1 - i) % 3
							? 'invisible sm:visible'
							: ''}">{weekLabel(week.start)}</span
					>
				</div>
			{/each}
		</div>
	</section>

	<section
		aria-labelledby="users-head"
		class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden"
	>
		<h2 id="users-head" class="m-0 px-4 sm:px-5 pt-4 pb-2 text-[15px] font-semibold">
			Users <span class="text-subtle font-normal">· {data.users.length}</span>
		</h2>
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-left text-sm">
				<thead>
					<tr class="text-xs text-subtle">
						<th class="font-normal px-4 sm:px-5 py-2">User</th>
						<th class="font-normal px-3 py-2">Joined</th>
						<th class="font-normal px-3 py-2">Last sync</th>
						<th class="font-normal px-3 py-2">Last trained</th>
						<th class="font-normal px-3 py-2 text-right">Exercises</th>
						<th class="font-normal px-3 py-2 text-right">Days</th>
						<th class="font-normal px-3 py-2 text-right">Sets</th>
						<th class="font-normal px-3 py-2 text-right">Routines</th>
						<th class="font-normal px-3 py-2 text-right">Sessions</th>
						<th class="font-normal px-4 sm:px-5 py-2 text-right">Role</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user (user.username)}
						<tr class="border-t-solid border-t-1 border-t-divider">
							<td class="px-4 sm:px-5 py-2.5 whitespace-nowrap">
								<span class="font-semibold">{user.username}</span>
								{#if user.isAdmin}
									<span
										class="ml-1.5 px-2 py-0.5 rounded-full bg-[rgba(215,245,90,0.15)] text-signal-ink text-[11px] font-semibold"
										>admin</span
									>
								{/if}
							</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-subtle whitespace-nowrap"
								>{date(user.createdAt)}</td
							>
							<td
								class="px-3 py-2.5 whitespace-nowrap {user.lastSync !== null &&
								data.generatedAt - user.lastSync <= 7 * DAY
									? ''
									: 'text-subtle'}">{ago(user.lastSync)}</td
							>
							<td class="px-3 py-2.5 whitespace-nowrap text-subtle">{ago(user.lastTrained)}</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-right">{user.exercises}</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-right">{user.trainingDays}</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-right">{formatKg(user.sets)}</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-right">{user.routines}</td>
							<td class="px-3 py-2.5 font-mono text-[13px] text-right">{user.activeSessions}</td>
							<td class="px-4 sm:px-5 py-1.5 text-right whitespace-nowrap">
								{#if user.isMe}
									<span class="text-xs text-faint">You</span>
								{:else}
									{@const armed = pending === user.username}
									<span class="inline-flex items-center gap-1">
										<button
											onclick={() => changeRole(user.username, !user.isAdmin)}
											disabled={busy}
											class="h-8 px-3 rounded-lg border-none cursor-pointer text-xs font-semibold disabled:opacity-50 {armed
												? user.isAdmin
													? 'bg-destructive text-white'
													: 'bg-signal text-on-signal'
												: 'bg-surface-3 text-soft'}"
										>
											{armed
												? user.isAdmin
													? "Confirm remove"
													: "Confirm"
												: user.isAdmin
													? "Remove admin"
													: "Make admin"}
										</button>
										{#if armed}
											<button
												onclick={() => (pending = null)}
												aria-label="Cancel"
												class="size-8 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
											>
												<i class="i-tabler-x block size-4 text-subtle"></i>
											</button>
										{/if}
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="m-0 px-4 sm:px-5 py-3 text-xs text-faint border-t-solid border-t-1 border-t-divider">
			"Joined" is empty for accounts created before sign-up dates were recorded. Sessions are
			current sign-ins.
		</p>
	</section>
</main>

<Nav />
