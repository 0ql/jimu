<script lang="ts">
	import { tick } from "svelte";
	import { type Exercise } from "./idb";
	import { daysAgo, formatKg, formatWeight } from "$lib/sets";
	import { LogEditor } from "./logEditor.svelte";

	import SetChips from "$lib/ui/SetChips.svelte";
	import SetKeypad from "$lib/ui/SetKeypad.svelte";
	import EditExerciseSheet from "./EditExerciseSheet.svelte";

	let {
		exercise,
		open = false,
		ontoggle,
	}: { exercise: Exercise; open?: boolean; ontoggle?: () => void } = $props();

	const editor = new LogEditor(() => exercise);
	let showPopup = $state(false);
	const showPad = $derived(open && editor.padOpen && !editor.textKeyboard);

	// Show the newest lines when the log opens.
	$effect(() => {
		if (editor.textarea) editor.textarea.scrollTop = editor.textarea.scrollHeight;
	});

	$effect(() => {
		if (!open) editor.resetKeyboard();
	});

	const onFocus = async () => {
		if (!editor.openPad()) return;
		await tick();
		// Park the log right under the nav so the parsed sets stay visible above the keypad.
		requestAnimationFrame(() => {
			if (!editor.textarea) return;
			const nav = parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
			);
			const top = editor.textarea.getBoundingClientRect().top - (nav || 0) - 36;
			window.scrollBy({ top, behavior: "smooth" });
		});
	};

	const keepFocus = (e: MouseEvent) => e.preventDefault();
</script>

<div
	class="border-b-solid border-b-1 border-b-[#222227] last:border-b-0 {open ? 'bg-[#1b1b1f]' : ''}"
>
	<button
		onclick={ontoggle}
		aria-expanded={open}
		class="w-full min-h-16 flex items-center gap-2.5 px-3.5 py-3 border-none bg-transparent text-left cursor-pointer"
	>
		<span
			class="size-2 rounded-full shrink-0 {editor.isToday && editor.log.current.sets.length
				? 'bg-signal'
				: 'bg-[#2e2e34]'}"
		></span>
		<span class="flex-1 min-w-0 flex flex-col gap-[3px]">
			<span class="text-base font-semibold truncate">{editor.title}</span>
			{#if editor.note.trim()}
				<span class="font-mono text-[12.5px] text-subtle truncate">{editor.note.trim()}</span>
			{/if}
			<span class="font-mono text-[12.5px] text-subtle truncate">
				{#if editor.log.current.date}<span class="text-faint">{editor.log.current.date}</span
					>&ensp;{/if}{editor.log.current.rest || "No sets yet"}
			</span>
		</span>
		<span class="text-xs text-[#7c7c85] whitespace-nowrap"
			>{daysAgo(editor.log.current.date, editor.log.current.year)}</span
		>
		<i
			class="i-tabler-chevron-down block size-[18px] shrink-0 text-subtle transition-transform {open
				? 'rotate-180'
				: ''}"
		></i>
	</button>

	{#if open}
		<div class="px-3.5 pb-4 flex flex-col gap-2.5">
			<div class="flex items-center justify-between">
				<label for="log-{exercise.id}" class="text-xs text-subtle">Log · one line per day</label>
				<button
					onclick={() => (showPopup = true)}
					class="h-8 px-2.5 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center gap-1.5 text-[13px] text-[#c9c9cf]"
				>
					<i class="i-tabler-pencil block size-3.5 text-[#c9c9cf]"></i>
					Edit
				</button>
			</div>

			<textarea
				id="log-{exercise.id}"
				bind:this={editor.textarea}
				bind:value={editor.workoutsString}
				oninput={editor.saveSoon}
				onchange={editor.save}
				spellcheck="false"
				autocomplete="off"
				onfocus={onFocus}
				inputmode={editor.inputmode}
				placeholder="{editor.stamp} a10x12 30x10 x8 x7 d15x7"
				class="w-full max-h-[10lh] overflow-y-auto resize-none rounded-[10px] border-solid border-[1.5px] border-signal bg-bg px-3 py-2.5 font-mono text-[15px] leading-[1.6] outline-none placeholder:text-[#5a5a62]"
			></textarea>

			{#if !editor.touch || editor.textKeyboard}
				<div class="flex gap-1.5">
					<button
						onmousedown={keepFocus}
						onclick={editor.addToday}
						aria-label="Start today's line"
						class="h-10 px-3 rounded-[10px] border-solid border-1 border-[#2e2e34] bg-surface-3 cursor-pointer flex items-center gap-1 font-mono text-sm {editor.isToday
							? 'text-faint'
							: 'text-signal'}"
					>
						<i class="i-tabler-plus block size-3.5 {editor.isToday ? 'text-faint' : 'text-signal'}"
						></i>{editor.stamp}
					</button>
					{#if editor.textKeyboard}
						<button
							onmousedown={keepFocus}
							onclick={() => editor.useSystemKeyboard(false)}
							class="h-10 px-3 rounded-[10px] border-solid border-1 border-[#2e2e34] bg-surface-3 cursor-pointer flex items-center gap-1.5 text-sm text-[#c9c9cf]"
						>
							<i class="i-tabler-dialpad block size-4 text-[#c9c9cf]"></i>
							Set keypad
						</button>
					{/if}
				</div>
			{/if}

			<span class="text-xs text-subtle">
				{editor.isToday ? "Today" : `Last · ${editor.log.current.date ?? "—"}`}
			</span>
			<SetChips sets={editor.log.current.sets} />

			<div class="grid grid-cols-3 gap-2">
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">Volume</span>
					<span class="font-display font-semibold text-base leading-[1.2] whitespace-nowrap"
						>{formatKg(editor.stats.volume)} kg</span
					>
				</div>
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">Top set</span>
					<span class="font-display font-semibold text-base leading-[1.2] whitespace-nowrap">
						{editor.stats.top
							? `${formatWeight(editor.stats.top.weight)}×${editor.stats.top.reps}`
							: "—"}
					</span>
				</div>
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">vs {editor.log.previous?.date ?? "previous"}</span>
					<span
						class="font-display font-semibold text-base leading-[1.2] whitespace-nowrap {editor.delta ===
							null || editor.delta === 0
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
		</div>
	{/if}
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
