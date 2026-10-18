<script lang="ts">
	import { tick, untrack } from "svelte";
	import {
		deleteExercise,
		type Exercise,
		loadExercises,
		routines,
		saveExercise,
		saveRoutine,
		type Routine,
	} from "./idb";
	import {
		dateStamp,
		daysAgo,
		formatKg,
		formatWeight,
		lineStats,
		parseLog,
		type ParsedSet,
	} from "$lib/sets";

	import Popup from "$lib/ui/Popup.svelte";
	import SetKeypad, { type KeypadKey } from "$lib/ui/SetKeypad.svelte";

	let {
		exercise,
		open = false,
		ontoggle,
	}: { exercise: Exercise; open?: boolean; ontoggle?: () => void } = $props();

	let showPopup = $state(false);
	let confirmDelete = $state(false);
	let textKeyboard = $state(false);
	let padOpen = $state(false);
	let textarea: HTMLTextAreaElement | undefined = $state();

	// Phones get the in-app keypad instead of the system keyboard; desktops keep typing normally.
	const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
	const showPad = $derived(open && padOpen && touch && !textKeyboard);

	let title = $state(untrack(() => exercise.title));
	let workoutsString = $state(untrack(() => exercise.workoutsString));
	let note = $state(untrack(() => exercise.note ?? ""));

	const save = () =>
		saveExercise({ ...exercise, title, workoutsString, note: note.trim() || undefined });

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	const saveSoon = () => {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 800);
	};

	const stamp = dateStamp();
	const log = $derived(parseLog(workoutsString));
	const isToday = $derived(log.current.date === stamp);
	const sessionCount = $derived(workoutsString.split("\n").filter((l) => l.trim()).length);
	const stats = $derived(lineStats(log.current.sets));
	const delta = $derived(
		log.previous ? Math.round(stats.volume - lineStats(log.previous.sets).volume) : null,
	);

	const chipLabel = (s: ParsedSet) =>
		s.kind === "invalid"
			? "?"
			: s.kind === "warmup"
				? "warm-up"
				: s.kind === "drop"
					? "drop"
					: `set ${s.n}`;
	const chipValue = (s: ParsedSet) =>
		s.kind === "invalid" ? s.token : `${formatWeight(s.weight)}×${s.reps}`;
	const chipClass: Record<ParsedSet["kind"], string> = {
		warmup: "border-dashed border-[#4a4a52] text-[#a3a3ab]",
		work: "border-solid border-[#34343b] bg-surface-3 text-fg",
		drop: "border-solid border-drop-border bg-drop-bg text-drop",
		invalid: "border-dashed border-[#e05a5a] text-[#ff9b9b]",
	};

	// Show the newest lines when the log opens.
	$effect(() => {
		if (textarea) textarea.scrollTop = textarea.scrollHeight;
	});

	/** Inserts text at the caret (or the end), keeping the keyboard open. */
	const insert = async (text: string, separate = false) => {
		if (!textarea) return;
		const focused = document.activeElement === textarea;
		const start = focused ? textarea.selectionStart : workoutsString.length;
		const end = focused ? textarea.selectionEnd : workoutsString.length;
		const before = workoutsString.slice(0, start);
		const insertText = separate && before && !/\s$/.test(before) ? ` ${text}` : text;
		workoutsString = before + insertText + workoutsString.slice(end);
		await tick();
		const caret = start + insertText.length;
		textarea.focus();
		textarea.setSelectionRange(caret, caret);
		saveSoon();
	};

	const addToday = async () => {
		if (!textarea) return;
		if (!isToday) {
			const trimmed = workoutsString.replace(/\s+$/, "");
			workoutsString = `${trimmed}${trimmed ? "\n" : ""}${stamp} `;
			saveSoon();
			await tick();
		}
		textarea.focus();
		textarea.setSelectionRange(workoutsString.length, workoutsString.length);
		textarea.scrollTop = textarea.scrollHeight;
	};

	const backspace = async () => {
		if (!textarea) return;
		const focused = document.activeElement === textarea;
		let start = focused ? textarea.selectionStart : workoutsString.length;
		const end = focused ? textarea.selectionEnd : workoutsString.length;
		if (start === end) start = Math.max(0, start - 1);
		workoutsString = workoutsString.slice(0, start) + workoutsString.slice(end);
		await tick();
		textarea.focus();
		textarea.setSelectionRange(start, start);
		saveSoon();
	};

	const onKey = (key: KeypadKey) => {
		if (key === "back") backspace();
		else if (key === "today") addToday();
		else if (key === "a" || key === "d") insert(key, true);
		else if (key === "space") insert(" ");
		else if (key === "enter") insert("\n");
		else insert(key);
	};

	const onFocus = async () => {
		if (!touch || textKeyboard || padOpen) return;
		padOpen = true;
		await tick();
		// Park the log right under the nav so the parsed sets stay visible above the keypad.
		requestAnimationFrame(() => {
			if (!textarea) return;
			const nav = parseFloat(
				getComputedStyle(document.documentElement).getPropertyValue("--nav-h"),
			);
			const top = textarea.getBoundingClientRect().top - (nav || 0) - 36;
			window.scrollBy({ top, behavior: "smooth" });
		});
	};

	const closePad = () => {
		padOpen = false;
		textarea?.blur();
	};

	// Switching hides one keyboard and focuses again so the other one appears.
	const useSystemKeyboard = async (on: boolean) => {
		textKeyboard = on;
		padOpen = !on;
		textarea?.blur();
		await tick();
		textarea?.focus();
	};

	$effect(() => {
		if (!open) {
			padOpen = false;
			textKeyboard = false;
		}
	});

	const inRoutine = (routine: Routine) => routine.exerciseIds.includes(exercise.id!);
	const toggleRoutine = (routine: Routine) =>
		saveRoutine({
			...routine,
			exerciseIds: inRoutine(routine)
				? routine.exerciseIds.filter((id) => id !== exercise.id)
				: [...routine.exerciseIds, exercise.id!],
		});

	const remove = async () => {
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		showPopup = false;
		await deleteExercise(exercise);
		await loadExercises();
	};

	$effect(() => {
		if (!showPopup) confirmDelete = false;
	});

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
			class="size-2 rounded-full shrink-0 {isToday && log.current.sets.length
				? 'bg-signal'
				: 'bg-[#2e2e34]'}"
		></span>
		<span class="flex-1 min-w-0 flex flex-col gap-[3px]">
			<span class="text-base font-semibold truncate">{title}</span>
			{#if note.trim()}
				<span class="font-mono text-[12.5px] text-subtle truncate">{note.trim()}</span>
			{/if}
			<span class="font-mono text-[12.5px] text-subtle truncate">
				{#if log.current.date}<span class="text-faint">{log.current.date}</span>&ensp;{/if}{log
					.current.rest || "No sets yet"}
			</span>
		</span>
		<span class="text-xs text-[#7c7c85] whitespace-nowrap">{daysAgo(log.current.date)}</span>
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
				bind:this={textarea}
				bind:value={workoutsString}
				oninput={saveSoon}
				onchange={save}
				spellcheck="false"
				autocomplete="off"
				onfocus={onFocus}
				inputmode={textKeyboard ? "text" : touch ? "none" : "decimal"}
				placeholder="{stamp} a10x12 30x10 x8 x7 d15x7"
				class="w-full max-h-[10lh] overflow-y-auto resize-none rounded-[10px] border-solid border-[1.5px] border-signal bg-bg px-3 py-2.5 font-mono text-[15px] leading-[1.6] outline-none placeholder:text-[#5a5a62]"
			></textarea>

			{#if !touch || textKeyboard}
				<div class="flex gap-1.5">
					<button
						onmousedown={keepFocus}
						onclick={addToday}
						aria-label="Start today's line"
						class="h-10 px-3 rounded-[10px] border-solid border-1 border-[#2e2e34] bg-surface-3 cursor-pointer flex items-center gap-1 font-mono text-sm {isToday
							? 'text-faint'
							: 'text-signal'}"
					>
						<i class="i-tabler-plus block size-3.5 {isToday ? 'text-faint' : 'text-signal'}"
						></i>{stamp}
					</button>
					{#if textKeyboard}
						<button
							onmousedown={keepFocus}
							onclick={() => useSystemKeyboard(false)}
							class="h-10 px-3 rounded-[10px] border-solid border-1 border-[#2e2e34] bg-surface-3 cursor-pointer flex items-center gap-1.5 text-sm text-[#c9c9cf]"
						>
							<i class="i-tabler-dialpad block size-4 text-[#c9c9cf]"></i>
							Set keypad
						</button>
					{/if}
				</div>
			{/if}

			<span class="text-xs text-subtle">
				{isToday ? "Today" : `Last · ${log.current.date ?? "—"}`}
			</span>
			{#if log.current.sets.length === 0}
				<span class="font-mono text-[13px] text-[#7c7c85]"
					>Type sets like a10x12 30x10 x8 d15x7</span
				>
			{:else}
				<div class="flex flex-wrap gap-1.5">
					{#each log.current.sets as set}
						<div
							class="min-w-[52px] px-2.25 pt-1.25 pb-1.5 rounded-lg border-1 flex flex-col gap-px {chipClass[
								set.kind
							]}"
						>
							<span class="font-mono text-[10px] opacity-80 text-inherit">{chipLabel(set)}</span>
							<span class="font-mono text-sm font-medium whitespace-nowrap text-inherit"
								>{chipValue(set)}</span
							>
						</div>
					{/each}
				</div>
			{/if}

			<div class="grid grid-cols-3 gap-2">
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">Volume</span>
					<span class="font-cond font-semibold text-[22px] leading-[1.1]"
						>{formatKg(stats.volume)} kg</span
					>
				</div>
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">Top set</span>
					<span class="font-cond font-semibold text-[22px] leading-[1.1]">
						{stats.top ? `${formatWeight(stats.top.weight)}×${stats.top.reps}` : "—"}
					</span>
				</div>
				<div class="flex flex-col gap-0.5 px-2.5 py-2 rounded-[10px] bg-surface-2">
					<span class="text-[11px] text-subtle">vs {log.previous?.date ?? "previous"}</span>
					<span
						class="font-cond font-semibold text-[22px] leading-[1.1] {delta === null || delta === 0
							? 'text-subtle'
							: delta > 0
								? 'text-signal'
								: 'text-drop'}"
					>
						{delta === null
							? "—"
							: `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatKg(Math.abs(delta))}`}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if showPad}
	<SetKeypad
		{title}
		todayLabel={stamp}
		todayDone={isToday}
		onkey={onKey}
		onabc={() => useSystemKeyboard(true)}
		ondone={closePad}
	/>
{/if}

<Popup title="Edit exercise" bind:showPopup>
	<div class="flex flex-col gap-4.5 pt-2">
		<div class="flex flex-col gap-1.5">
			<label for="name-{exercise.id}" class="text-xs text-subtle">Name</label>
			<input
				id="name-{exercise.id}"
				spellcheck="false"
				bind:value={title}
				onchange={save}
				class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 text-[17px] font-semibold outline-none focus:border-signal"
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="note-{exercise.id}" class="text-xs text-subtle">Machine setup</label>
			<input
				id="note-{exercise.id}"
				spellcheck="false"
				autocomplete="off"
				bind:value={note}
				onchange={save}
				placeholder="Sitz 3, Rolle 2"
				class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 font-mono text-[15px] outline-none focus:border-signal placeholder:text-[#5a5a62]"
			/>
		</div>

		{#if $routines.length > 0}
			<fieldset class="m-0 p-0 border-none flex flex-col gap-2">
				<legend class="text-xs text-subtle p-0 mb-2">In routines</legend>
				<div class="flex flex-wrap gap-1.5">
					{#each $routines as routine (routine.id)}
						{@const checked = inRoutine(routine)}
						<label
							class="h-10 pl-2.5 pr-3.5 rounded-full flex items-center gap-2 text-sm font-semibold cursor-pointer border-solid border-1
								{checked ? 'bg-dark border-dark text-bg' : 'border-[#2e2e34] text-[#c9c9cf]'}"
						>
							<input
								type="checkbox"
								{checked}
								onchange={() => toggleRoutine(routine)}
								class="m-0 size-4 accent-[#111]"
							/>
							{routine.name}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="flex flex-col rounded-2xl border-solid border-1 border-hairline overflow-hidden">
			<a
				href="/analytics?exercise={exercise.id}"
				class="flex items-center gap-3 min-h-13 px-3.5 no-underline border-b-solid border-b-1 border-b-[#222227]"
			>
				<i class="i-tabler-chart-bar block size-5"></i>
				<span class="flex-1">Progress chart</span>
				<span class="font-mono text-xs text-subtle">
					{sessionCount} session{sessionCount === 1 ? "" : "s"}
				</span>
			</a>
			<button
				onclick={remove}
				class="flex items-center gap-3 min-h-13 px-3.5 border-none bg-transparent cursor-pointer text-left text-base {confirmDelete
					? 'bg-destructive text-white'
					: 'text-[#ff8a8a]'}"
			>
				<i class="i-tabler-trash block size-5 {confirmDelete ? 'text-white' : 'text-[#ff8a8a]'}"
				></i>
				{confirmDelete ? "Tap again to delete" : "Delete exercise…"}
			</button>
		</div>

		<button
			onclick={() => (showPopup = false)}
			class="h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-[#111]"
		>
			Done
		</button>
	</div>
</Popup>
