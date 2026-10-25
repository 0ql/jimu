<script module lang="ts">
	import type { Badge } from "#lib/routineBadges.js";

	export type NoticeOption = {
		id: number;
		name: string;
		badge: Badge | undefined;
		/** "due today", "Mon", "27.10." */
		when: string;
		dueToday: boolean;
	};
</script>

<script lang="ts">
	import RoutineChip from "#lib/ui/RoutineChip.svelte";

	/**
	 * Shown on an exercise opened without a routine filter, when it belongs to a routine in a
	 * split: logging now wouldn't count for the split. Picking a routine turns its filter on.
	 */
	let {
		options,
		onpick,
		ondismiss,
	}: { options: NoticeOption[]; onpick: (id: number) => void; ondismiss: () => void } = $props();
</script>

<div
	role="status"
	class="flex flex-col gap-2.5 px-3 pt-2.5 pb-3 rounded-xl bg-[var(--warn-bg)] border-solid border-1 border-[var(--warn-edge)]"
>
	<div class="flex gap-2.5 items-start">
		<i class="i-tabler-alert-circle block size-[19px] shrink-0 mt-px text-[var(--warn)]"></i>
		<span class="flex-1 min-w-0 flex flex-col gap-0.5">
			<span class="text-sm font-semibold text-[var(--warn)]">Today won't count for a split</span>
			<span class="text-[12.5px] leading-snug text-[var(--warn)]"
				>No routine is selected. Which one are you training?</span
			>
		</span>
		<button
			onclick={ondismiss}
			aria-label="Dismiss for today"
			data-plain
			class="size-7 -mt-1 -mr-1 shrink-0 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
		>
			<i class="i-tabler-x block size-[18px] text-[var(--warn)]"></i>
		</button>
	</div>
	<div class="flex flex-wrap gap-2 pl-[29px]">
		{#each options as option (option.id)}
			<button
				onclick={() => onpick(option.id)}
				class="h-9 pl-[7px] pr-3 rounded-[10px] border-solid border-1 border-[var(--warn-edge)] cursor-pointer flex items-center gap-[7px] text-[13.5px] whitespace-nowrap"
				style="background: color-mix(in srgb, var(--background) 55%, transparent)"
			>
				<RoutineChip badge={option.badge} />
				{option.name}
				<span class="text-xs {option.dueToday ? 'text-signal-ink' : 'text-subtle'}"
					>{option.when}</span
				>
			</button>
		{/each}
	</div>
</div>
