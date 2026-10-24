<script lang="ts">
	import { formatWeight, type ParsedSet } from "$lib/sets";

	let { sets, large = false }: { sets: ParsedSet[]; large?: boolean } = $props();

	const label = (s: ParsedSet) =>
		s.kind === "invalid"
			? "?"
			: s.kind === "warmup"
				? "warm-up"
				: s.kind === "drop"
					? "drop"
					: `set ${s.n}`;
	const value = (s: ParsedSet) =>
		s.kind === "invalid" ? s.token : `${formatWeight(s.weight)}×${s.reps}`;
	const kindClass: Record<ParsedSet["kind"], string> = {
		warmup: "border-dashed border-ghost text-subtle",
		work: "border-solid border-edge-2 bg-surface-3 text-fg",
		drop: "border-solid border-drop-border bg-drop-bg text-drop",
		invalid: "border-dashed border-invalid-border text-invalid",
	};
</script>

{#if sets.length === 0}
	<span class="font-mono text-[13px] text-dim">Type sets like a10x12 30x10 x8 d15x7</span>
{:else}
	<div class="flex flex-wrap gap-1.5">
		{#each sets as set}
			<div
				class="rounded-lg border-1 flex flex-col gap-px {large
					? 'min-w-[60px] px-2.5 pt-1.5 pb-[7px]'
					: 'min-w-[52px] px-2.25 pt-1.25 pb-1.5'} {kindClass[set.kind]}"
			>
				<span class="font-mono text-[10px] opacity-80 text-inherit">{label(set)}</span>
				<span
					class="font-mono font-medium whitespace-nowrap text-inherit {large
						? 'text-base'
						: 'text-sm'}">{value(set)}</span
				>
			</div>
		{/each}
	</div>
{/if}
