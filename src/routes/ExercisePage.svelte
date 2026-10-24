<script lang="ts">
	import { onDestroy, tick } from "svelte";
	import { type Exercise } from "./idb";
	import { formatKg, formatWeight, lineStats } from "$lib/sets";
	import { historyDate, LogEditor } from "./logEditor.svelte";

	import SetChips from "$lib/ui/SetChips.svelte";
	import SetKeypad from "$lib/ui/SetKeypad.svelte";
	import EditExerciseSheet from "./EditExerciseSheet.svelte";

	type Neighbour = { id: number; title: string };

	let {
		exercise,
		backLabel,
		routine = null,
		onback,
		onnavigate,
	}: {
		exercise: Exercise;
		backLabel: string;
		/** Set when the page is opened from a routine: where this exercise sits in it. */
		routine?: {
			position: number;
			total: number;
			prev: Neighbour | null;
			next: Neighbour | null;
		} | null;
		onback: () => void;
		onnavigate: (id: number) => void;
	} = $props();

	const editor = new LogEditor(() => exercise);
	let showPopup = $state(false);
	const showPad = $derived(editor.padOpen && !editor.textKeyboard);
	let scroller: HTMLElement | undefined = $state();
	let logSection: HTMLElement | undefined = $state();
	let headerHeight = $state(64);

	// A save still waiting when the page closes or moves to the next exercise goes out now.
	onDestroy(editor.flush);

	const bars = $derived.by(() => {
		const max = Math.max(1, ...editor.recent.map((b) => b.volume));
		return editor.recent.map((b) => ({
			...b,
			height: Math.max(4, Math.round((b.volume / max) * 56)),
		}));
	});

	// Show the newest lines when the page opens.
	$effect(() => {
		if (editor.textarea) editor.textarea.scrollTop = editor.textarea.scrollHeight;
	});

	const onFocus = async () => {
		if (!editor.openPad()) return;
		await tick();
		// Park the log under the top bar so the parsed sets stay visible above the keypad.
		requestAnimationFrame(() => {
			if (!scroller || !logSection) return;
			const top = logSection.getBoundingClientRect().top - headerHeight;
			scroller.scrollBy({ top, behavior: "smooth" });
		});
	};

	const keepFocus = (e: MouseEvent) => e.preventDefault();
	// With the keypad open, the top of the history is the keypad's own entry (see SetKeypad).
	// Closing the keypad takes that entry out; leave the page once it has gone.
	const back = () => {
		if (!showPad) return onback();
		addEventListener("popstate", () => onback(), { once: true });
		editor.closePad();
	};

	const go = (id: number) => {
		editor.flush();
		onnavigate(id);
	};

	const statClass =
		"flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface border-solid border-1 border-hairline";
	const statValue = "font-display font-semibold text-base leading-[1.2] whitespace-nowrap";
</script>

<div
	bind:this={scroller}
	role="dialog"
	aria-modal="true"
	aria-label={editor.title}
	class="fixed inset-0 z-[35] bg-bg overflow-y-auto overscroll-contain flex flex-col"
>
	<!-- The exercise's name and setup sit in the top bar itself, so the log starts higher up.
	     The bar is exactly as tall as the list's search bar (--nav-h), so nothing jumps. -->
	<header
		bind:offsetHeight={headerHeight}
		class="sticky top-0 z-10 shrink-0 flex items-center gap-1 pl-1 pr-2 bg-bg border-b-solid border-b-1 border-b-rule"
		style="height: var(--nav-h, 77px); padding-top: env(safe-area-inset-top)"
	>
		<button
			onclick={back}
			aria-label="Back to {backLabel}"
			class="size-10 shrink-0 flex items-center justify-center rounded-[10px] border-none bg-transparent cursor-pointer"
		>
			<i class="i-tabler-chevron-left block size-6 text-soft"></i>
		</button>
		<div class="flex-1 min-w-0 flex flex-col">
			<h1 class="m-0 font-display font-semibold text-[20px] leading-tight truncate">
				{editor.title}
			</h1>
			{#if editor.note.trim()}
				<span class="font-mono text-xs text-subtle truncate">{editor.note.trim()}</span>
			{/if}
		</div>
		<a
			href="/analytics?exercise={exercise.id}"
			aria-label="Progress chart"
			class="size-10 shrink-0 rounded-[10px] flex items-center justify-center"
		>
			<i class="i-tabler-chart-line block size-5 text-soft"></i>
		</a>
		<button
			onclick={() => (showPopup = true)}
			aria-label="Edit name and setup"
			class="size-10 shrink-0 rounded-[10px] border-none bg-transparent cursor-pointer flex items-center justify-center"
		>
			<i class="i-tabler-pencil block size-5 text-soft"></i>
		</button>
	</header>

	<div
		class="flex-1 px-4 flex flex-col gap-4"
		style="padding-bottom: calc(var(--pad-h, 0px) + 1.5rem)"
	>
		<section bind:this={logSection} aria-label="Log" class="flex flex-col gap-2.5">
			<!-- The log runs edge to edge right under the top bar (whose border is its top edge),
			     so long lines wrap less. -->
			<textarea
				id="page-log-{exercise.id}"
				aria-label="Log, one line per day"
				bind:this={editor.textarea}
				bind:value={editor.workoutsString}
				oninput={editor.saveSoon}
				onchange={editor.save}
				onfocus={onFocus}
				spellcheck="false"
				autocomplete="off"
				inputmode={editor.inputmode}
				placeholder="{editor.stamp} a10x12 30x10 x8 x7 d15x7"
				class="-mx-4 w-[calc(100%+2rem)] min-h-[4lh] max-h-[8lh] overflow-y-auto resize-none border-solid border-x-0 border-t-0 border-b-[1.5px] bg-surface px-4 py-2.5 font-mono text-[15px] leading-[1.65] outline-none placeholder:text-placeholder {showPad
					? 'border-signal-ink'
					: 'border-edge focus:border-signal-ink'}"></textarea>

			{#if !editor.touch || editor.textKeyboard}
				<div class="flex gap-1.5">
					<button
						onmousedown={keepFocus}
						onclick={editor.addToday}
						aria-label="Start today's line"
						class="h-10 px-3 rounded-[10px] border-solid border-1 border-edge bg-surface-3 cursor-pointer flex items-center gap-1 font-mono text-sm {editor.isToday
							? 'text-faint'
							: 'text-signal-ink'}"
					>
						<i
							class="i-tabler-plus block size-3.5 {editor.isToday
								? 'text-faint'
								: 'text-signal-ink'}"
						></i>{editor.stamp}
					</button>
					{#if editor.textKeyboard}
						<button
							onmousedown={keepFocus}
							onclick={() => editor.useSystemKeyboard(false)}
							class="h-10 px-3 rounded-[10px] border-solid border-1 border-edge bg-surface-3 cursor-pointer flex items-center gap-1.5 text-sm text-soft"
						>
							<i class="i-tabler-dialpad block size-4 text-soft"></i>
							Set keypad
						</button>
					{/if}
				</div>
			{/if}

			<SetChips sets={editor.log.current.sets} />

			<div class="grid grid-cols-3 gap-2">
				<div class={statClass}>
					<span class="text-[11px] text-subtle">Volume</span>
					<span class={statValue}>{formatKg(editor.stats.volume)} kg</span>
				</div>
				<div class={statClass}>
					<span class="text-[11px] text-subtle">Top set</span>
					<span class={statValue}>
						{editor.stats.top
							? `${formatWeight(editor.stats.top.weight)}×${editor.stats.top.reps}`
							: "—"}
					</span>
				</div>
				<div class={statClass}>
					<span class="text-[11px] text-subtle">vs {editor.log.previous?.date ?? "previous"}</span>
					<span
						class="{statValue} {editor.delta === null || editor.delta === 0
							? 'text-subtle'
							: editor.delta > 0
								? 'text-signal-ink'
								: 'text-drop'}"
					>
						{editor.delta === null
							? "—"
							: `${editor.delta > 0 ? "+" : editor.delta < 0 ? "−" : "±"}${formatKg(Math.abs(editor.delta))}`}
					</span>
				</div>
			</div>
		</section>

		{#if bars.length > 1}
			<section aria-label="Volume per session" class="flex flex-col gap-2">
				<div class="flex justify-between items-baseline">
					<h2 class="m-0 text-sm font-semibold">Volume</h2>
					<span class="text-xs text-subtle">last {bars.length} sessions</span>
				</div>
				<div
					role="img"
					aria-label="Volume over the last {bars.length} sessions: {bars
						.map((b) => `${b.date} ${formatKg(b.volume)} kg`)
						.join(', ')}"
					class="h-14 flex items-end gap-1.5"
				>
					{#each bars as bar, i}
						<div
							class="flex-1 min-w-0 rounded-t-[4px] {i === bars.length - 1
								? 'bg-signal'
								: 'bg-track'}"
							style="height: {bar.height}px"
						></div>
					{/each}
				</div>
			</section>
		{/if}

		<section aria-label="History" class="flex flex-col">
			<div class="flex justify-between items-baseline pb-1">
				<h2 class="m-0 text-sm font-semibold">History</h2>
				<span class="text-xs text-subtle">
					{editor.sessionCount} session{editor.sessionCount === 1 ? "" : "s"}
				</span>
			</div>
			{#each editor.history as entry}
				<div class="flex items-baseline gap-3 py-2.5 border-t-solid border-t-1 border-t-divider">
					<span class="font-mono text-xs text-faint shrink-0 w-[60px]">{historyDate(entry)}</span>
					<span class="flex-1 min-w-0 font-mono text-[13px] text-soft truncate">{entry.rest}</span>
					<span class="font-mono text-xs text-subtle shrink-0">
						{formatKg(lineStats(entry.sets).volume)}
					</span>
				</div>
			{:else}
				<p class="m-0 py-2 text-sm text-subtle">Earlier sessions show up here.</p>
			{/each}
		</section>
	</div>

	{#if !showPad}
		<footer
			class="sticky bottom-0 shrink-0 flex items-center gap-2 px-3 pt-2.5 bg-panel border-t-solid border-t-1 border-t-divider"
			style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))"
		>
			{#if routine}
				<button
					onclick={() => routine.prev && go(routine.prev.id)}
					disabled={!routine.prev}
					aria-label={routine.prev ? `Previous: ${routine.prev.title}` : "No previous exercise"}
					class="size-11 shrink-0 rounded-[10px] border-solid border-1 border-edge bg-surface-3 cursor-pointer flex items-center justify-center disabled:opacity-35 disabled:cursor-default"
				>
					<i class="i-tabler-chevron-left block size-5 text-soft"></i>
				</button>
			{/if}
			<button
				onmousedown={keepFocus}
				onclick={editor.addToday}
				class="flex-1 min-w-0 h-11 rounded-[10px] border-none bg-signal cursor-pointer flex items-center justify-center gap-1.5 text-[15px] font-semibold text-on-signal"
			>
				<i class="i-tabler-plus block size-[18px] text-on-signal"></i>Log sets
			</button>
			{#if routine}
				{#if routine.next}
					<button
						onclick={() => go(routine.next!.id)}
						aria-label="Next: {routine.next.title}"
						class="h-11 max-w-[140px] shrink-0 pl-3 pr-2 rounded-[10px] border-solid border-1 border-edge bg-surface-3 cursor-pointer flex items-center gap-1 text-left"
					>
						<span class="min-w-0 flex flex-col leading-[1.15]">
							<span class="text-[10px] text-faint"
								>Next · {routine.position + 1}/{routine.total}</span
							>
							<span class="text-[13px] text-soft truncate">{routine.next.title}</span>
						</span>
						<i class="i-tabler-chevron-right block size-[18px] shrink-0 text-soft"></i>
					</button>
				{:else}
					<span class="h-11 shrink-0 px-3 flex items-center font-mono text-xs text-faint">
						{routine.position}/{routine.total}
					</span>
				{/if}
			{/if}
		</footer>
	{/if}

	{#if showPad}
		<SetKeypad
			title={editor.title}
			todayLabel={editor.stamp}
			todayDone={editor.isToday}
			onkey={editor.onKey}
			onabc={() => editor.useSystemKeyboard(true)}
			ondone={editor.closePad}
		/>
	{/if}

	<EditExerciseSheet {exercise} {editor} bind:showPopup />
</div>
