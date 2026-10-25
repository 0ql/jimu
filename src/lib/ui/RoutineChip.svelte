<script lang="ts">
	import type { Badge } from "#lib/routineBadges.js";

	/**
	 * A routine's short label in its colour; `badge` undefined draws a grey placeholder. `done`
	 * rings it (trained that day), `moved` dashes it (a missed day caught up).
	 */
	let {
		badge,
		small = false,
		done = false,
		moved = false,
	}: { badge: Badge | undefined; small?: boolean; done?: boolean; moved?: boolean } = $props();

	const color = $derived(badge ? `var(--routine-${badge.color})` : "var(--subtle)");
</script>

<span
	class="{small
		? 'h-[18px] min-w-[18px] px-1 rounded-[6px] text-[9.5px]'
		: 'h-[22px] min-w-[22px] px-1.5 rounded-[7px] text-[11px]'} shrink-0 inline-flex items-center justify-center font-semibold leading-none"
	style="color: {color}; background: color-mix(in srgb, {color} {done
		? 30
		: 16}%, transparent); {done
		? `box-shadow: inset 0 0 0 1.5px ${color}`
		: moved
			? `outline: 1px dashed ${color}; outline-offset: -1px`
			: ''}"
	aria-hidden="true">{badge?.label ?? "?"}</span
>
