<script lang="ts">
	import { tick } from "svelte";
	import { type Exercise, routines } from "./idb";
	import { datedLines, formatKg, formatWeight, lineStats, parseLine } from "$lib/sets";
	import { LogEditor } from "./logEditor.svelte";

	import SetChips from "$lib/ui/SetChips.svelte";
	import SetKeypad from "$lib/ui/SetKeypad.svelte";
	import EditExerciseSheet from "./EditExerciseSheet.svelte";

	let { exercise, onescape }: { exercise: Exercise; onescape?: () => void } = $props();

	const editor = new LogEditor(() => exercise);
	let showPopup = $state(false);
	const showPad = $derived(editor.padOpen && !editor.textKeyboard);

	const tags = $derived($routines.filter((r) => r.exerciseIds.includes(exercise.id!)));
	// Each non-empty log line, with its full date (year worked out like on the sessions page).
	const sessions = $derived.by(() => {
		const dated = datedLines(editor.workoutsString);
		let next = 0;
		return editor.workoutsString
			.split("\n")
			.filter((l) => l.trim())
			.map((line) => {
				const parsed = parseLine(line);
				return { ...parsed, fullDate: parsed.date ? (dated[next++]?.date ?? null) : null };
			});
	});
	const historyDate = (entry: (typeof sessions)[number]) =>
		entry.fullDate
			? entry.fullDate.toLocaleDateString("de-DE", {
					day: "2-digit",
					month: "2-digit",
					year: "2-digit",
				})
			: (entry.date ?? "—");
	const counts = $derived({
		work: editor.log.current.sets.filter((s) => s.kind === "work").length,
		drop: editor.log.current.sets.filter((s) => s.kind === "drop").length,
	});
	const bars = $derived.by(() => {
		const recent = sessions.slice(-8).map((p) => ({
			date: p.date?.slice(0, 5) ?? "—",
			volume: lineStats(p.sets).volume,
		}));
		const max = Math.max(1, ...recent.map((b) => b.volume));
		return recent.map((b) => ({ ...b, height: Math.max(4, Math.round((b.volume / max) * 110)) }));
	});
	const history = $derived(sessions.slice(0, -1).reverse());

	// Show the newest lines when an exercise opens.
	$effect(() => {
		if (editor.textarea) editor.textarea.scrollTop = editor.textarea.scrollHeight;
	});

	/** Focuses the log with the caret at the end (Enter in the list). */
	export const focusLog = async () => {
		await tick();
		const end = editor.workoutsString.length;
		editor.textarea?.focus();
		editor.textarea?.setSelectionRange(end, end);
	};

	const onKeydown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			editor.addToday();
		} else if (e.key === "Escape") {
			editor.save();
			editor.closePad();
			onescape?.();
		}
	};

	const statClass = "flex flex-col gap-0.5 px-3 py-2.5 rounded-[10px] bg-surface-2";
	const statValue = "font-display font-semibold text-[22px] leading-[1.2] whitespace-nowrap";
</script>

<div class="flex flex-col gap-5">
	<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		<div class="flex flex-col gap-1.5 min-w-0">
			<h1 class="m-0 font-display font-semibold text-[32px] leading-none">{editor.title}</h1>
			<!-- Fixed height and no wrapping: the line is 24px whether or not routine tags show,
			     so the layout below doesn't move between exercises. -->
			<div class="h-6 flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
				{#if editor.note.trim()}
					<span class="font-mono text-[13px] text-[#bdbdc4] truncate">{editor.note.trim()}</span>
					<span class="text-[#4a4a52]" aria-hidden="true">·</span>
				{/if}
				{#each tags as tag (tag.id)}
					<span
						class="h-6 shrink-0 px-2.5 rounded-full border-solid border-1 border-[#2e2e34] text-xs font-semibold text-[#c9c9cf] flex items-center"
						>{tag.name}</span
					>
				{/each}
				<span class="text-[13px] text-subtle shrink-0">
					{editor.sessionCount} session{editor.sessionCount === 1 ? "" : "s"}
				</span>
			</div>
		</div>
		<div class="flex gap-2">
			<a
				href="/analytics?exercise={exercise.id}"
				class="h-10 px-3.5 rounded-[10px] bg-surface-3 no-underline flex items-center gap-2 text-sm"
			>
				<i class="i-tabler-chart-bar block size-4"></i>Progress chart
			</a>
			<button
				onclick={() => (showPopup = true)}
				class="h-10 px-3.5 rounded-[10px] border-none bg-surface-3 cursor-pointer flex items-center gap-2 text-sm"
			>
				<i class="i-tabler-pencil block size-4"></i>Edit
			</button>
		</div>
	</div>

	<div class="flex flex-wrap gap-5 items-start">
		<section
			aria-label="Log"
			class="flex-[3_1_440px] min-w-0 flex flex-col gap-3.5 p-[18px] rounded-2xl bg-surface border-solid border-1 border-hairline"
		>
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<label for="desk-log-{exercise.id}" class="text-[13px] text-subtle"
					>Log · one line per day</label
				>
				<span class="font-mono text-xs text-[#7c7c85]">a warm-up · d drop set · x8 same kg</span>
			</div>
			<textarea
				id="desk-log-{exercise.id}"
				bind:this={editor.textarea}
				bind:value={editor.workoutsString}
				oninput={editor.saveSoon}
				onchange={editor.save}
				onfocus={editor.openPad}
				onkeydown={onKeydown}
				spellcheck="false"
				autocomplete="off"
				inputmode={editor.inputmode}
				placeholder="{editor.stamp} a10x12 30x10 x8 x7 d15x7"
				class="w-full min-h-[6lh] max-h-[16lh] overflow-y-auto resize-y rounded-[10px] border-solid border-[1.5px] border-signal bg-bg px-3.5 py-3 font-mono text-base leading-[1.7] outline-none placeholder:text-[#5a5a62]"
			></textarea>
			<div class="flex flex-wrap items-center gap-2">
				<button
					onclick={editor.addToday}
					class="h-[34px] px-3 rounded-lg border-solid border-1 border-[#2e2e34] bg-surface-3 cursor-pointer font-mono text-[13px] {editor.isToday
						? 'text-faint'
						: 'text-signal'}">+ {editor.stamp}</button
				>
				<span class="text-xs text-[#7c7c85]">
					or press <kbd>Ctrl</kbd> <kbd>Enter</kbd> to start today's line
				</span>
			</div>

			<div class="flex flex-col gap-2 pt-2.5 border-t-solid border-t-1 border-t-[#222227]">
				<span class="text-xs text-subtle">
					{editor.isToday ? "Today · parsed" : `Last · ${editor.log.current.date ?? "—"}`}
				</span>
				<SetChips sets={editor.log.current.sets} large />
			</div>

			<div class="grid grid-cols-[repeat(auto-fit,minmax(124px,1fr))] gap-2.5">
				<div class={statClass}>
					<span class="text-xs text-subtle">Volume</span>
					<span class={statValue}>{formatKg(editor.stats.volume)} kg</span>
				</div>
				<div class={statClass}>
					<span class="text-xs text-subtle">Top set</span>
					<span class={statValue}>
						{editor.stats.top
							? `${formatWeight(editor.stats.top.weight)}×${editor.stats.top.reps}`
							: "—"}
					</span>
				</div>
				<div class={statClass}>
					<span class="text-xs text-subtle">Sets</span>
					<span class={statValue}>
						{counts.work}{counts.drop ? ` + ${counts.drop}d` : ""}
					</span>
				</div>
				<div class={statClass}>
					<span class="text-xs text-subtle">vs {editor.log.previous?.date ?? "previous"}</span>
					<span
						class="{statValue} {editor.delta === null || editor.delta === 0
							? 'text-subtle'
							: editor.delta > 0
								? 'text-signal'
								: 'text-drop'}"
					>
						{editor.delta === null
							? "—"
							: `${editor.delta > 0 ? "+" : editor.delta < 0 ? "−" : "±"}${formatKg(Math.abs(editor.delta))}`}
					</span>
				</div>
			</div>
		</section>

		<div class="flex-[2_1_320px] min-w-0 flex flex-col gap-5">
			<section
				aria-label="Volume per session"
				class="p-[18px] rounded-2xl bg-surface border-solid border-1 border-hairline flex flex-col gap-3.5"
			>
				<div class="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-0.5">
					<h2 class="m-0 text-[15px] font-semibold">Volume per session</h2>
					<span class="text-xs text-subtle">kg · warm-ups excluded</span>
				</div>
				{#if bars.length === 0}
					<p class="text-sm text-subtle">No sessions yet.</p>
				{:else}
					<div
						role="img"
						aria-label="Volume over the last {bars.length} sessions: {bars
							.map((b) => `${b.date} ${formatKg(b.volume)} kg`)
							.join(', ')}"
						class="h-[150px] flex items-end gap-2"
					>
						{#each bars as bar, i}
							{@const latest = i === bars.length - 1}
							<div class="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1">
								<span class="font-mono text-[10px] {latest ? 'text-fg' : 'text-[#7c7c85]'}"
									>{formatKg(bar.volume)}</span
								>
								<div
									class="w-full max-w-9 rounded-t-[5px] rounded-b-[2px] {latest
										? 'bg-signal'
										: 'bg-[#3a3a41]'}"
									style="height: {bar.height}px"
								></div>
								<span class="font-mono text-[10px] text-[#7c7c85]">{bar.date}</span>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<section
				aria-label="History"
				class="p-[18px] rounded-2xl bg-surface border-solid border-1 border-hairline flex flex-col gap-1"
			>
				<h2 class="m-0 mb-1.5 text-[15px] font-semibold">History</h2>
				{#each history as entry}
					<div class="flex items-baseline gap-3 py-2 border-t-solid border-t-1 border-t-[#222227]">
						<span class="font-mono text-xs text-faint shrink-0">{historyDate(entry)}</span>
						<span class="flex-1 min-w-0 font-mono text-[13px] text-[#c9c9cf] truncate"
							>{entry.rest}</span
						>
						<span class="font-mono text-xs text-subtle shrink-0">
							{formatKg(lineStats(entry.sets).volume)} kg
						</span>
					</div>
				{:else}
					<p class="text-sm text-subtle">Earlier sessions show up here.</p>
				{/each}
			</section>
		</div>
	</div>
</div>

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
