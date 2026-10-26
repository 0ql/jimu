<script lang="ts">
	import { page } from "$app/state";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
	// Actions keep the request's query string: the server checks the request again from it.
	const action = (name: string) => `${page.url.search}&/${name}`;
</script>

<svelte:head><title>Connect {data.client.name} · jimu</title></svelte:head>

<main class="h-[100dvh] overflow-y-auto flex flex-col items-center justify-center gap-8 py-6">
	<span class="font-display font-semibold text-[44px] leading-none tracking-[-0.02em]"
		>jimu<span class="text-signal-ink">.</span></span
	>

	<form
		method="POST"
		class="w-full max-w-sm flex flex-col gap-4 p-5 rounded-2xl bg-surface border-solid border-1 border-hairline"
	>
		<div class="flex flex-col gap-1">
			<h1 class="m-0 font-display font-semibold text-[22px] leading-tight">
				Connect {data.client.name}?
			</h1>
			<span class="text-sm text-subtle">
				Requested by <span class="font-semibold text-fg">{data.client.host}</span> for
				<span class="font-semibold text-fg">{data.username}</span>
			</span>
		</div>

		<ul class="m-0 p-0 list-none flex flex-col gap-2.5 text-sm">
			<li class="flex gap-2.5">
				<i class="i-tabler-eye block size-[18px] shrink-0 mt-px text-signal-ink"></i>
				<span class="text-soft">
					<span class="text-fg font-semibold">Can read</span> your exercises, logs, sessions, routines
					and splits
				</span>
			</li>
			{#if data.asksToWrite}
				<li>
					<label class="flex gap-2.5 cursor-pointer">
						<input
							type="checkbox"
							name="allow_changes"
							checked
							class="m-0 mt-0.5 size-[18px] shrink-0 accent-signal-ink cursor-pointer"
						/>
						<span class="text-soft">
							<span class="text-fg font-semibold">Can make changes:</span> create and edit exercises,
							routines and splits, and log sets
						</span>
					</label>
				</li>
				<li class="flex gap-2.5">
					<i class="i-tabler-trash-off block size-[18px] shrink-0 mt-px text-subtle"></i>
					<span class="text-soft">
						<span class="text-fg font-semibold">Can't delete</span> anything
					</span>
				</li>
			{:else}
				<li class="flex gap-2.5">
					<i class="i-tabler-pencil-off block size-[18px] shrink-0 mt-px text-subtle"></i>
					<span class="text-soft">
						<span class="text-fg font-semibold">Can't change</span> or delete anything
					</span>
				</li>
			{/if}
			<li class="flex gap-2.5">
				<i class="i-tabler-plug-connected-x block size-[18px] shrink-0 mt-px text-subtle"></i>
				<span class="text-soft">Disconnect it any time in Settings</span>
			</li>
		</ul>

		<p
			class="m-0 px-3 py-2.5 rounded-xl text-[13px] leading-snug {data.returnIsLocal
				? 'bg-[var(--warn-bg)] text-[var(--warn)]'
				: 'bg-surface-2 text-subtle'}"
		>
			{#if data.returnIsLocal}
				<span class="text-[var(--warn)]"
					>Afterwards a program on this computer ({data.returnHost}) receives access. Only allow
					this if you just started the connection, for example from Claude Code.</span
				>
			{:else}
				<span class="text-subtle"
					>Afterwards you go back to <span class="font-semibold text-fg">{data.returnHost}</span
					>.</span
				>
			{/if}
		</p>

		<div class="flex gap-2">
			<button
				formaction={action("deny")}
				class="flex-1 h-12 rounded-xl border-none bg-surface-3 cursor-pointer text-[15px] font-semibold"
				>Deny</button
			>
			<button
				formaction={action("allow")}
				class="flex-1 h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-on-signal"
				>Allow</button
			>
		</div>
	</form>
</main>
