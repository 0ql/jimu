<script lang="ts">
	import { onMount, tick } from "svelte";
	import { page } from "$app/state";
	import { pushState, replaceState } from "$app/navigation";
	import {
		exercises,
		routines,
		splits,
		loadDB,
		loadExercises,
		loadRoutines,
		loadSplits,
		addExercise,
		dataRevision,
		syncWithServer,
		saveRoutine,
		markTrained,
		trainingRoutineId,
		unmarkTrained,
		type Exercise,
	} from "../idb";
	import { dateStamp, daysAgo, isTodayLine, parseLog } from "#lib/sets.js";
	import { isoDate, members, relativeDay, splitStatus, trainedDates } from "#lib/splits.js";
	import { routineBadges } from "#lib/routineBadges.js";
	import { toast } from "#lib/toast.svelte.js";
	import type { PageProps } from "./$types";

	import ExerciseDetail from "../ExerciseDetail.svelte";
	import ExercisePage from "../ExercisePage.svelte";
	import SplitNotice, { type NoticeOption } from "../SplitNotice.svelte";
	import Nav from "../Nav.svelte";
	import SearchBar from "../SearchBar.svelte";
	import Popup from "#lib/ui/Popup.svelte";
	import { online } from "#lib/network.js";

	let searchString: string = $state("");
	let { data }: PageProps = $props();
	let showAddPopup = $state(false);
	let newTitle = $state("");
	let newNote = $state("");
	// Opened from "Create “…”" in search: the exercise starts with today's line ready to type into.
	let newFromSearch = $state(false);
	let nameInput: HTMLInputElement | undefined = $state();
	let noteInput: HTMLInputElement | undefined = $state();
	let selectedRoutineId: number | null = $state(null);
	// Height of the routine chips bar on phones, so the list's end clears it.
	let chipsHeight = $state(0);
	// Empty states wait for IndexedDB so they don't flash on every visit.
	let loaded = $state(false);

	onMount(async () => {
		await loadDB();
		await loadExercises();
		await loadRoutines();
		await loadSplits();

		// "Train" on the routines page links here with ?routine=<id>. On a new device the routines
		// only arrive with the sync below, so it is tried again after that.
		const routineParam = Number(page.url.searchParams.get("routine"));
		const applyRoutineParam = () => {
			if (routineParam && $routines.some((r) => r.id === routineParam)) {
				selectedRoutineId = routineParam;
			}
		};
		applyRoutineParam();

		// Sessions link here with ?exercise=<id>: select it on desktop, open its page on phones.
		const exerciseParam = Number(page.url.searchParams.get("exercise"));
		if (exerciseParam && $exercises.some((e) => e.id === exerciseParam)) {
			selectedId = exerciseParam;
			if (!wide) openPage(exerciseParam);
		}

		// Offline the page data is the stored copy, so its server timestamps are stale: skip the
		// sync. Edits stay on this device and upload when the connection is back (see +layout).
		if (!$online) {
			loaded = true;
			return;
		}

		await syncWithServer("exercises", data.lastModified?.getTime() ?? 0);
		// After a possible first download, so a new device doesn't claim to have no exercises.
		loaded = true;
		await syncWithServer("routines", data.routineLastModified?.getTime() ?? 0);
		if (selectedRoutineId === null) applyRoutineParam();
		await syncWithServer("splits", data.splitLastModified?.getTime() ?? 0);
	});

	// Logging with a routine filter on counts the day for that routine (see recordTraining).
	$effect(() => {
		trainingRoutineId.set(selectedRoutineId);
		return () => trainingRoutineId.set(null);
	});

	const activeRoutine = $derived(
		selectedRoutineId !== null ? ($routines.find((r) => r.id === selectedRoutineId) ?? null) : null,
	);

	const visibleExercises = $derived(
		$exercises
			.filter((exercise) => {
				const inRoutine =
					activeRoutine === null || activeRoutine.exerciseIds.includes(exercise.id!);
				const matchesSearch = exercise.title
					.toLowerCase()
					.normalize("NFD")
					.replace(/[̀-ͯ]/g, "")
					.includes(searchString.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
				return inRoutine && matchesSearch;
			})
			// A routine keeps its own order; otherwise alphabetical.
			.sort((a, b) =>
				activeRoutine
					? activeRoutine.exerciseIds.indexOf(a.id!) - activeRoutine.exerciseIds.indexOf(b.id!)
					: a.title.localeCompare(b.title),
			),
	);

	// Wide screens get the two-pane layout: list on the left, the selected exercise on the right.
	let wide = $state(false);
	$effect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		wide = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (wide = e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	});

	let selectedId: number | null = $state(null);
	const selected = $derived(
		visibleExercises.find((e) => e.id === selectedId) ?? visibleExercises[0] ?? null,
	);
	let searchInput: HTMLInputElement | undefined = $state();
	let detail: ReturnType<typeof ExerciseDetail> | undefined = $state();
	let listEl: HTMLElement | undefined = $state();

	const select = async (id: number | undefined) => {
		if (id === undefined) return;
		selectedId = id;
		await tick();
		listEl?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
	};

	const move = (step: number) => {
		if (!visibleExercises.length) return;
		const i = visibleExercises.findIndex((e) => e.id === selected?.id);
		const next = Math.min(visibleExercises.length - 1, Math.max(0, i + step));
		select(visibleExercises[next].id);
	};

	// Phones open an exercise as its own page. It is a history entry on top of the list
	// (shallow routing), so Back returns to the list with its scroll and search untouched.
	const openPage = (id: number) => pushState("", { exercise: id });
	const closePage = () => history.back();
	const pageExercise = $derived(
		wide || page.state.exercise === undefined
			? null
			: ($exercises.find((e) => e.id === page.state.exercise) ?? null),
	);
	// Deleted from its own page: leave it.
	$effect(() => {
		if (loaded && !wide && page.state.exercise !== undefined && !pageExercise) closePage();
	});

	/** Where the open page sits in the active routine, for the previous/next buttons. */
	const routineNav = $derived.by(() => {
		if (!activeRoutine || !pageExercise) return null;
		const byId = new Map($exercises.map((e) => [e.id, e]));
		const list = [...new Set(activeRoutine.exerciseIds)]
			.map((id) => byId.get(id))
			.filter((e) => e !== undefined)
			.map((e) => ({ id: e.id!, title: e.title }));
		const i = list.findIndex((e) => e.id === pageExercise.id);
		if (i === -1) return null;
		return {
			position: i + 1,
			total: list.length,
			prev: list[i - 1] ?? null,
			next: list[i + 1] ?? null,
		};
	});

	// Without a routine filter, logging an exercise that belongs to a split doesn't count for it:
	// the exercise then offers its routines, the one due soonest first.
	const today = isoDate();
	const badges = $derived(routineBadges($routines));
	/** Exercises whose notice was closed; until the page is left. */
	let dismissed = $state<number[]>([]);
	const nextDue = $derived.by(() => {
		const due = new Map<number, string>();
		if ($splits.length === 0) return due;
		const trained = trainedDates({ routines: $routines, exercises: $exercises });
		for (const split of $splits) {
			for (const day of splitStatus(split, trained, today).days) {
				if (day.routineId === null || day.done) continue;
				const known = due.get(day.routineId);
				if (!known || day.date < known) due.set(day.routineId, day.date);
			}
		}
		return due;
	});

	const noticeFor = (exercise: Exercise | null): NoticeOption[] | null => {
		if (!exercise || activeRoutine || $splits.length === 0) return null;
		if (dismissed.includes(exercise.id!)) return null;
		const inSplit = new Set($splits.flatMap(members));
		const candidates = $routines.filter(
			(r) => inSplit.has(r.id!) && r.exerciseIds.includes(exercise.id!),
		);
		// Already counted today for one of them (picked earlier, or logged with its filter on).
		if (!candidates.length || candidates.some((r) => r.trainedOn?.includes(today))) return null;
		return candidates
			.map((r) => {
				const date = nextDue.get(r.id!);
				return {
					id: r.id!,
					name: r.name,
					badge: badges.get(r.id!),
					date: date ?? "9999",
					when: !date ? "" : date === today ? "due today" : relativeDay(date, today),
					dueToday: date === today,
				};
			})
			.sort((a, b) => a.date.localeCompare(b.date));
	};
	const pageNotice = $derived(noticeFor(pageExercise));
	const deskNotice = $derived(wide ? noticeFor(selected) : null);

	/** Turns the routine's filter on and counts today for it, with an undo in the toast. */
	const pickRoutine = async (id: number) => {
		const before = selectedRoutineId;
		const routine = $routines.find((r) => r.id === id);
		if (!routine) return;
		const wasCounted = routine.trainedOn?.includes(today) ?? false;
		selectedRoutineId = id;
		await markTrained(id);
		const splitNames = $splits.filter((s) => members(s).includes(id)).map((s) => s.name);
		toast.success(`Today counts for ${routine.name} in ${splitNames.join(", ")}`, 6000, {
			label: "Undo",
			run: () => {
				selectedRoutineId = before;
				if (!wasCounted) unmarkTrained(id);
			},
		});
	};

	const backToList = () => {
		(listEl?.querySelector(`[data-id="${selected?.id}"]`) as HTMLElement | null)?.focus();
	};

	const onSearchKey = (e: KeyboardEvent) => {
		if (!wide) return;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			move(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (selected) detail?.focusLog();
			else if (searchString.trim()) createFromSearch();
		} else if (e.key === "Escape") {
			searchString = "";
		}
	};

	/** Desktop shortcuts: / search, ↑↓ switch exercise, Enter edit log. */
	const onWindowKey = (e: KeyboardEvent) => {
		if (!wide || showAddPopup || e.defaultPrevented) return;
		const target = e.target as HTMLElement;
		if (target.closest("input, textarea, select, [role=dialog], section.fixed")) return;
		const inList = !!target.closest("[data-id]");
		if (e.key === "/") {
			e.preventDefault();
			searchInput?.focus();
		} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			if (target.closest("button, a") && !inList) return;
			e.preventDefault();
			move(e.key === "ArrowDown" ? 1 : -1);
		} else if (e.key === "Enter" && (inList || !target.closest("button, a"))) {
			e.preventDefault();
			detail?.focusLog();
		}
	};

	/** Opens the new-exercise prompt; a name from search is prefilled so only the setup is left. */
	const openAdd = async (name = "") => {
		newTitle = name.trim();
		newNote = "";
		newFromSearch = !!newTitle;
		showAddPopup = true;
		await tick();
		(newTitle ? noteInput : nameInput)?.focus();
	};

	const create = async (title: string, workoutsString = "", note = "") => {
		if (!title.trim()) return;
		const id = await addExercise(title.trim(), workoutsString, note);
		if (selectedRoutineId !== null && activeRoutine) {
			await saveRoutine({ ...activeRoutine, exerciseIds: [...activeRoutine.exerciseIds, id] });
		}
		newTitle = "";
		newNote = "";
		showAddPopup = false;
		if (!wide) openPage(id);
		else {
			searchString = "";
			await select(id);
			detail?.focusLog();
		}
	};

	const createFromSearch = () => openAdd(searchString);
	const submitNew = () => create(newTitle, newFromSearch ? `${dateStamp()} ` : "", newNote);
</script>

<svelte:window onkeydown={onWindowKey} />

{#snippet createButton()}
	<button
		onclick={createFromSearch}
		class="h-12 px-4.5 rounded-xl border-none bg-signal cursor-pointer flex items-center gap-2 text-[15px] font-semibold text-on-signal"
	>
		<i class="i-tabler-plus block size-[18px] text-on-signal"></i>
		Create “{searchString.trim()}”
	</button>
{/snippet}

{#snippet routineChips(wrap: boolean)}
	{#if $routines.length > 0}
		<div
			class="flex gap-1.5 {wrap
				? 'flex-wrap'
				: 'overflow-x-auto -mx-4 px-4 [scrollbar-width:none]'}"
		>
			{#each [{ id: null, name: "All" }, ...$routines] as routine (routine.id)}
				{@const active = selectedRoutineId === routine.id}
				<button
					onclick={() => (selectedRoutineId = routine.id ?? null)}
					aria-pressed={active}
					class="{wrap
						? 'h-[30px] px-3 text-[13px]'
						: 'h-[34px] px-3.5 text-sm'} rounded-full font-semibold whitespace-nowrap border-solid border-1 cursor-pointer transition-colors
						{active ? 'bg-dark text-bg border-dark' : 'bg-transparent border-edge text-soft'}"
				>
					{routine.name}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#if wide}
	<main
		class="max-w-[1408px] mx-auto px-4 flex gap-6 items-start"
		style="padding-top: calc(var(--nav-h, 5rem) + 1.5rem); padding-bottom: 1.5rem"
	>
		<aside
			aria-label="Exercises"
			class="w-[340px] xl:w-[380px] shrink-0 sticky flex flex-col gap-3"
			style="top: calc(var(--nav-h, 5rem) + 1.5rem); max-height: calc(100dvh - var(--nav-h, 5rem) - 3rem)"
		>
			<SearchBar
				bind:value={searchString}
				bind:input={searchInput}
				hint="/"
				onkeydown={onSearchKey}
			/>
			{@render routineChips(true)}

			{#if visibleExercises.length > 0}
				<div
					bind:this={listEl}
					class="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-surface border-solid border-1 border-hairline"
				>
					{#each visibleExercises as exercise (exercise.id)}
						{@const current = parseLog(exercise.workoutsString).current}
						{@const isSelected = exercise.id === selected?.id}
						<button
							data-id={exercise.id}
							onclick={() => select(exercise.id)}
							aria-current={isSelected ? "true" : undefined}
							class="w-full flex items-center gap-2.5 px-3.5 py-2.5 border-none border-b-solid border-b-1 border-b-divider-2 last:border-b-0 text-left cursor-pointer {isSelected
								? 'bg-selected'
								: 'bg-transparent hover:bg-lift'}"
						>
							<span
								class="size-[7px] rounded-full shrink-0 {isTodayLine(current) && current.sets.length
									? 'bg-signal'
									: 'bg-edge'}"
							></span>
							<span class="flex-1 min-w-0 flex flex-col gap-0.5">
								<span
									class="text-[15px] font-semibold truncate {isSelected
										? 'text-fg'
										: 'text-strong'}">{exercise.title}</span
								>
							</span>
							<span class="text-xs text-dim whitespace-nowrap"
								>{daysAgo(current.date, current.year)}</span
							>
						</button>
					{/each}
				</div>
			{:else if searchString.trim()}
				<div class="flex flex-col items-start gap-3 py-6 px-1">
					<p class="text-subtle text-sm">No exercise matches “{searchString.trim()}”</p>
					{@render createButton()}
				</div>
			{/if}

			<p class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-dim px-1">
				<span><kbd>/</kbd> search</span>
				<span><kbd>↑</kbd> <kbd>↓</kbd> switch</span>
				<span><kbd>Enter</kbd> edit log</span>
				<span><kbd>Esc</kbd> back to list</span>
			</p>
		</aside>

		<section class="flex-1 min-w-0" aria-label="Selected exercise">
			{#if selected}
				{#key `${selected.id}:${$dataRevision}`}
					<ExerciseDetail
						bind:this={detail}
						exercise={selected}
						onescape={backToList}
						notice={deskNotice ? deskNoticeSnippet : undefined}
					/>
				{/key}
			{:else if loaded && $exercises.length === 0}
				<p class="text-subtle py-16 text-center">
					No exercises yet. Add your first one with New exercise.
				</p>
			{/if}
		</section>
	</main>
{:else}
	<main
		class="flex flex-col gap-3"
		style="padding-top: calc(var(--nav-h, 11rem) + 0.75rem); padding-bottom: calc({!wide &&
		$routines.length > 0
			? chipsHeight
			: 0}px + 2.5rem)"
	>
		{#if visibleExercises.length > 0}
			<div class="rounded-2xl bg-surface border-solid border-1 border-hairline overflow-hidden">
				{#each visibleExercises as exercise (exercise.id)}
					{@const current = parseLog(exercise.workoutsString).current}
					<button
						onclick={() => openPage(exercise.id!)}
						class="w-full min-h-16 flex items-center gap-2.5 pl-3.5 pr-2 py-3 border-none border-b-solid border-b-1 border-b-divider last:border-b-0 bg-transparent active:bg-raised text-left cursor-pointer"
					>
						<span
							class="size-2 rounded-full shrink-0 {isTodayLine(current) && current.sets.length
								? 'bg-signal'
								: 'bg-edge'}"
						></span>
						<span class="flex-1 min-w-0 flex flex-col gap-[3px]">
							<span class="text-base font-semibold truncate">{exercise.title}</span>
							{#if exercise.note?.trim()}
								<span class="font-mono text-[12.5px] text-subtle truncate"
									>{exercise.note.trim()}</span
								>
							{/if}
						</span>
						<span class="text-xs text-dim whitespace-nowrap"
							>{daysAgo(current.date, current.year)}</span
						>
						<i class="i-tabler-chevron-right block size-[18px] shrink-0 text-ghost"></i>
					</button>
				{/each}
			</div>
		{:else if searchString.trim()}
			<div class="flex flex-col items-center gap-3.5 py-8 px-2 text-center">
				<p class="text-subtle text-[15px]">No exercise matches “{searchString.trim()}”</p>
				{@render createButton()}
			</div>
		{:else if loaded && $exercises.length === 0}
			<p class="text-subtle text-center py-8">No exercises yet. Tap + to add your first one.</p>
		{/if}
	</main>
{/if}

{#if pageExercise}
	{#key `${pageExercise.id}:${$dataRevision}`}
		<ExercisePage
			exercise={pageExercise}
			backLabel={activeRoutine?.name ?? "Exercises"}
			routine={routineNav}
			onback={closePage}
			onnavigate={(id) => replaceState("", { exercise: id })}
			notice={pageNotice ? pageNoticeSnippet : undefined}
		/>
	{/key}
{/if}

{#snippet pageNoticeSnippet()}
	{#if pageNotice && pageExercise}
		{@const id = pageExercise.id!}
		<SplitNotice
			options={pageNotice}
			onpick={pickRoutine}
			ondismiss={() => (dismissed = [...dismissed, id])}
		/>
	{/if}
{/snippet}

{#snippet deskNoticeSnippet()}
	{#if deskNotice && selected}
		{@const id = selected.id!}
		<SplitNotice
			options={deskNotice}
			onpick={pickRoutine}
			ondismiss={() => (dismissed = [...dismissed, id])}
		/>
	{/if}
{/snippet}

<Popup title="New exercise" bind:showPopup={showAddPopup}>
	<form
		class="flex flex-col gap-4 pt-1"
		onsubmit={(e) => {
			e.preventDefault();
			submitNew();
		}}
	>
		<div class="flex flex-col gap-1.5">
			<label for="new-name" class="text-xs text-subtle">Name</label>
			<input
				id="new-name"
				bind:this={nameInput}
				bind:value={newTitle}
				spellcheck="false"
				autocomplete="off"
				placeholder="Cable biceps curl"
				class="h-[50px] w-full rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 text-[17px] font-semibold outline-none focus:border-signal-ink placeholder:text-placeholder placeholder:font-normal"
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<label for="new-note" class="text-xs text-subtle"
				>Machine setup <span class="text-faint">· optional</span></label
			>
			<input
				id="new-note"
				bind:this={noteInput}
				bind:value={newNote}
				spellcheck="false"
				autocomplete="off"
				placeholder="Seat 3, pad 2"
				class="h-[50px] w-full rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 font-mono text-[15px] outline-none focus:border-signal-ink placeholder:text-placeholder"
			/>
		</div>
		<button
			type="submit"
			disabled={!newTitle.trim()}
			class="h-12 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-on-signal disabled:opacity-40 disabled:cursor-default"
		>
			Create exercise
		</button>
	</form>
</Popup>

<Nav onadd={() => openAdd()}>
	{#if !wide}
		<div class="flex gap-2">
			<div class="flex-1 min-w-0">
				<SearchBar bind:value={searchString} compact />
			</div>
			<button
				onclick={() => openAdd()}
				aria-label="New exercise"
				class="size-10 shrink-0 rounded-xl border-none bg-signal cursor-pointer flex items-center justify-center"
			>
				<i class="i-tabler-plus block size-5 text-on-signal"></i>
			</button>
		</div>
	{/if}
</Nav>

{#if !wide && $routines.length > 0}
	<!-- Routine filter sits at the bottom on phones, right above the tab bar, within thumb reach. -->
	<div
		bind:offsetHeight={chipsHeight}
		class="fixed left-0 right-0 z-30 px-4 py-2 bg-bg border-t-solid border-t-1 border-t-rule"
		style="bottom: var(--tab-h, 0px)"
	>
		{@render routineChips(false)}
	</div>
{/if}
