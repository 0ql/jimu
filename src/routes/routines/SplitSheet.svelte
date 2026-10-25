<script lang="ts">
	import { tick, untrack } from "svelte";
	import { addSplit, deleteSplit, saveSplit, type Routine, type Split } from "../idb";
	import type { Badge } from "#lib/routineBadges.js";
	import {
		WEEKDAYS,
		addDays,
		dayMonth,
		lastTrained,
		members,
		newSplit,
		splitStatus,
		weekday,
	} from "#lib/splits.js";
	import Popup from "#lib/ui/Popup.svelte";
	import RoutineChip from "#lib/ui/RoutineChip.svelte";

	/** `split` null creates a new one. */
	let {
		split,
		routines,
		trained,
		badges,
		today,
		showPopup = $bindable(false),
	}: {
		split: Split | null;
		routines: Routine[];
		trained: Map<number, string[]>;
		badges: Map<number, Badge>;
		today: string;
		showPopup?: boolean;
	} = $props();

	const original = untrack(() => split);
	const byId = $derived(new Map(routines.map((r) => [r.id!, r])));
	let draft = $state<Split>(
		untrack(() => {
			const known = new Set(routines.map((r) => r.id));
			const base = split ?? newSplit(today);
			return {
				...base,
				pace: base.pace ?? "interval",
				gymDays: [...(base.gymDays ?? [])],
				routineIds: base.routineIds.filter((id) => known.has(id)),
				days: base.days.map((id) => (id !== null && known.has(id) ? id : null)),
			};
		}),
	);
	let confirmDelete = $state(false);
	let adding = $state(false);

	const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((v, i) => v === b[i]);

	/**
	 * The day the schedule counts from. A rotation that keeps its dates is anchored so it carries
	 * on from where the split stands now; weekdays only catch up what was missed after a change.
	 */
	const start = $derived.by(() => {
		const d = draft;
		if (d.kind === "weekdays") {
			const unchanged =
				original?.kind === "weekdays" &&
				sameList(original.days, d.days) &&
				(original.catchUp || !d.catchUp);
			return unchanged ? original.start : today;
		}
		if (d.keepOrder) return original?.start ?? today;
		if (
			original?.kind === "rotation" &&
			!original.keepOrder &&
			original.pace === d.pace &&
			original.everyDays === d.everyDays &&
			sameList(original.gymDays ?? [], d.gymDays) &&
			sameList(original.routineIds, d.routineIds)
		)
			return original.start;
		const flowing = splitStatus(
			{ ...d, keepOrder: true, start: original?.start ?? today },
			trained,
			today,
			60,
		).next;
		if (!flowing) return today;
		// Step back to where the first routine would have been, so the dates line up from here.
		const steps = members(d).indexOf(flowing.routineId);
		if (d.pace === "interval") return addDays(flowing.date, -steps * d.everyDays);
		let date = flowing.date;
		for (let i = 0; i < steps; i++) {
			do date = addDays(date, -1);
			while (!d.gymDays.includes(weekday(date)));
		}
		return date;
	});

	const preview = $derived(splitStatus({ ...draft, start }, trained, today, 14).days);

	const caption = $derived.by(() => {
		const d = draft;
		if (d.kind === "weekdays") {
			const n = d.days.filter((id) => id !== null).length;
			return `The same days every week · ${n} training day${n === 1 ? "" : "s"}`;
		}
		const order = members(d);
		if (order.length === 0) return "Add the routines you rotate through.";
		if (!d.keepOrder) return "Keeps to these dates; a missed day is skipped.";
		let last: { id: number; date: string } | null = null;
		for (const id of order) {
			const date = lastTrained(trained, id, today);
			if (date && (!last || date >= last.date)) last = { id, date };
		}
		if (!last) return `Starts with ${byId.get(order[0])?.name}.`;
		return `Continues from your last session: ${byId.get(last.id)?.name} on ${WEEKDAYS[weekday(last.date)]} ${dayMonth(last.date)}`;
	});

	const restDays = $derived(
		draft.everyDays === 1
			? "No rest days"
			: `${draft.everyDays - 1} rest day${draft.everyDays === 2 ? "" : "s"} between sessions`,
	);

	const available = $derived(routines.filter((r) => !draft.routineIds.includes(r.id!)));
	const valid = $derived(
		!!draft.name.trim() &&
			members(draft).length > 0 &&
			!(draft.kind === "rotation" && draft.pace === "gym-days" && draft.gymDays.length === 0),
	);

	const toggleGymDay = (i: number) =>
		(draft.gymDays = draft.gymDays.includes(i)
			? draft.gymDays.filter((d) => d !== i)
			: [...draft.gymDays, i].sort((a, b) => a - b));

	const moveItem = (from: number, to: number) => {
		if (from === to || to < 0 || to >= draft.routineIds.length) return;
		const next = [...draft.routineIds];
		next.splice(to, 0, ...next.splice(from, 1));
		draft.routineIds = next;
	};

	// Drag by the handle, like the routine editor: the row under the finger swaps places.
	let dragIndex: number | null = $state(null);
	let orderList: HTMLElement | undefined = $state();

	const startDrag = (e: PointerEvent, index: number) => {
		if (e.button !== 0) return;
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragIndex = index;
	};

	const drag = (e: PointerEvent) => {
		if (dragIndex === null || !orderList) return;
		const rows = [...orderList.children];
		const under = rows.findIndex((row) => e.clientY < row.getBoundingClientRect().bottom);
		const to = under === -1 ? rows.length - 1 : under;
		moveItem(dragIndex, to);
		dragIndex = to;
	};

	const endDrag = () => (dragIndex = null);

	const moveByKey = async (e: KeyboardEvent, index: number) => {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
		e.preventDefault();
		const to = index + (e.key === "ArrowUp" ? -1 : 1);
		moveItem(index, to);
		await tick();
		orderList?.children[to]?.querySelector("button")?.focus();
	};

	const setDay = (i: number, value: string) => {
		const days = [...draft.days];
		days[i] = value === "" ? null : Number(value);
		draft.days = days;
	};

	const save = async () => {
		if (!valid) return;
		const result: Split = { ...draft, name: draft.name.trim(), start };
		if (original) await saveSplit(result);
		else await addSplit(result);
		showPopup = false;
	};

	const remove = async () => {
		if (!original) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		await deleteSplit(original);
		showPopup = false;
	};

	const PACES = [
		["interval", "Every few days"],
		["gym-days", "On set days"],
	] as const;
	const KINDS = [
		["rotation", "Rotation"],
		["weekdays", "Weekdays"],
	] as const;
	const plural = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
	const segment =
		"flex-1 h-[34px] rounded-[9px] border-none cursor-pointer text-[13px] font-semibold";
	const radio =
		"flex gap-[11px] items-start px-3 py-2.5 rounded-xl border-solid border-1 cursor-pointer";
</script>

{#snippet option(on: boolean, title: string, text: string, pick: () => void)}
	<label
		class="{radio} {on ? 'border-signal-ink' : 'border-edge'}"
		style={on ? "background: color-mix(in srgb, var(--signal) 6%, transparent)" : ""}
	>
		<input
			type="radio"
			checked={on}
			onchange={pick}
			class="m-0 mt-0.5 size-4 shrink-0 accent-signal-ink"
		/>
		<span class="flex flex-col gap-px">
			<span class="text-sm font-medium">{title}</span>
			<span class="text-xs text-subtle">{text}</span>
		</span>
	</label>
{/snippet}

{#snippet previewDays()}
	<div class="flex flex-col gap-2">
		<span class="text-xs text-subtle">Next two weeks</span>
		<ol class="m-0 p-0 list-none flex">
			{#each preview as day (day.date)}
				<li class="flex-1 min-w-0 flex flex-col items-center gap-1">
					<small class="text-[9.5px] text-faint">{WEEKDAYS[weekday(day.date)].slice(0, 2)}</small>
					{#if day.routineId !== null}
						<RoutineChip
							badge={badges.get(day.routineId)}
							small
							done={day.done}
							moved={day.moved}
						/>
					{:else}
						<span class="size-1 my-[7px] rounded-full bg-track"></span>
					{/if}
				</li>
			{/each}
		</ol>
		<span class="text-xs text-faint">{caption}</span>
	</div>
{/snippet}

<Popup title={original ? "Edit split" : "New split"} wide bind:showPopup>
	<form
		class="flex flex-col gap-5 pt-2"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<div class="flex flex-col md:flex-row gap-4 md:gap-7">
			<div class="flex-1 min-w-0 flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label for="split-name" class="text-xs text-subtle">Name</label>
					<input
						id="split-name"
						bind:value={draft.name}
						spellcheck="false"
						autocomplete="off"
						placeholder="Push Pull Legs"
						class="h-[46px] w-full rounded-xl border-solid border-1 border-edge-2 bg-bg px-3.5 text-base font-semibold outline-none focus:border-signal-ink placeholder:text-placeholder placeholder:font-normal"
					/>
				</div>

				{#if draft.kind === "rotation"}
					<div class="flex flex-col gap-1.5">
						<div class="flex justify-between text-xs text-subtle">
							<span id="split-order">Routines in order</span>
							{#if draft.routineIds.length > 1}<span>drag to reorder</span>{/if}
						</div>
						<div class="rounded-xl border-solid border-1 border-hairline bg-bg">
							<ol bind:this={orderList} aria-labelledby="split-order" class="m-0 p-0 list-none">
								{#each draft.routineIds as id, i (id)}
									<li
										class="flex items-center gap-2.5 h-11 pr-1 border-b-solid border-b-1 border-b-divider-2 {dragIndex ===
										i
											? 'bg-raised'
											: ''}"
									>
										<button
											type="button"
											aria-label="Move {byId.get(id)?.name}, {i + 1} of {draft.routineIds
												.length}. Arrow keys move it."
											onpointerdown={(e) => startDrag(e, i)}
											onpointermove={drag}
											onpointerup={endDrag}
											onpointercancel={endDrag}
											onkeydown={(e) => moveByKey(e, i)}
											class="w-10 h-11 shrink-0 border-none bg-transparent flex items-center justify-center touch-none {dragIndex ===
											i
												? 'cursor-grabbing'
												: 'cursor-grab'}"
										>
											<i class="i-tabler-grip-vertical block size-[18px] text-faint"></i>
										</button>
										<RoutineChip badge={badges.get(id)} />
										<span class="flex-1 min-w-0 truncate text-[15px]">{byId.get(id)?.name}</span>
										<button
											type="button"
											onclick={() => (draft.routineIds = draft.routineIds.filter((x) => x !== id))}
											aria-label="Remove {byId.get(id)?.name}"
											class="size-9 shrink-0 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
										>
											<i class="i-tabler-x block size-4 text-subtle"></i>
										</button>
									</li>
								{/each}
							</ol>
							{#if adding}
								<div class="flex flex-wrap gap-1.5 p-2">
									{#each available as routine (routine.id)}
										<button
											type="button"
											onclick={() => {
												draft.routineIds = [...draft.routineIds, routine.id!];
												if (available.length === 0) adding = false;
											}}
											class="h-9 pl-1.5 pr-3 rounded-[10px] border-solid border-1 border-edge bg-surface-3 cursor-pointer flex items-center gap-2 text-sm"
										>
											<RoutineChip badge={badges.get(routine.id!)} />{routine.name}
										</button>
									{:else}
										<span class="px-1 py-1.5 text-sm text-subtle"
											>Every routine is in this split.</span
										>
									{/each}
								</div>
							{:else}
								<button
									type="button"
									onclick={() => (adding = true)}
									disabled={available.length === 0}
									class="w-full h-[42px] border-none bg-transparent cursor-pointer flex items-center justify-center gap-1.5 text-[13px] text-subtle disabled:opacity-40 disabled:cursor-default"
								>
									<i class="i-tabler-plus block size-[15px] text-subtle"></i>Add routine
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<div class="hidden md:block">{@render previewDays()}</div>
			</div>

			<div class="hidden md:block w-px shrink-0 bg-divider"></div>

			<div class="flex-1 min-w-0 flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<span class="text-xs text-subtle">Schedule</span>
					<div
						role="radiogroup"
						aria-label="Schedule"
						class="flex gap-1 p-1 rounded-xl bg-bg border-solid border-1 border-hairline"
					>
						{#each KINDS as [kind, label]}
							<button
								type="button"
								role="radio"
								aria-checked={draft.kind === kind}
								onclick={() => (draft.kind = kind)}
								class="{segment} {draft.kind === kind
									? 'bg-dark text-bg'
									: 'bg-transparent text-soft'}">{label}</button
							>
						{/each}
					</div>
				</div>

				{#if draft.kind === "rotation"}
					<div class="flex items-center justify-between gap-3">
						<span id="split-pace" class="text-[15px]">Train</span>
						<div
							role="radiogroup"
							aria-labelledby="split-pace"
							class="flex gap-0.5 p-[3px] rounded-[10px] bg-bg border-solid border-1 border-hairline"
						>
							{#each PACES as [pace, label]}
								<button
									type="button"
									role="radio"
									aria-checked={draft.pace === pace}
									onclick={() => (draft.pace = pace)}
									class="h-[30px] px-3 rounded-[7px] border-none cursor-pointer text-[13px] font-medium {draft.pace ===
									pace
										? 'bg-surface-3 text-fg'
										: 'bg-transparent text-subtle'}">{label}</button
								>
							{/each}
						</div>
					</div>

					{#if draft.pace === "gym-days"}
						<div class="flex flex-col gap-2">
							<div class="flex gap-1.5" role="group" aria-label="Gym days">
								{#each WEEKDAYS as day, i}
									{@const on = draft.gymDays.includes(i)}
									<button
										type="button"
										aria-pressed={on}
										aria-label={plural[i]}
										onclick={() => toggleGymDay(i)}
										class="flex-1 h-10 rounded-[10px] border-solid border-1 cursor-pointer text-[13px] font-semibold {on
											? 'bg-dark text-bg border-dark'
											: 'bg-transparent text-soft border-edge'}">{day.slice(0, 2)}</button
									>
								{/each}
							</div>
							<span class="text-xs text-faint">
								{draft.gymDays.length === 0
									? "Pick the days you go to the gym."
									: `${draft.gymDays.length} day${draft.gymDays.length === 1 ? "" : "s"} a week · the routines take turns`}
							</span>
						</div>
					{:else}
						<div class="flex items-center justify-between gap-3">
							<span class="flex flex-col">
								<span class="text-[15px]">Every</span>
								<span class="text-xs text-faint">{restDays}</span>
							</span>
							<div
								class="flex items-center gap-1 p-[3px] rounded-xl bg-bg border-solid border-1 border-hairline"
							>
								<button
									type="button"
									onclick={() => (draft.everyDays = Math.max(1, draft.everyDays - 1))}
									disabled={draft.everyDays <= 1}
									aria-label="Fewer days"
									class="w-[38px] h-9 rounded-[9px] border-none bg-surface-3 cursor-pointer text-lg disabled:opacity-40"
									>−</button
								>
								<span class="w-16 text-center font-semibold text-[15px]" aria-live="polite"
									>{draft.everyDays === 1 ? "1 day" : `${draft.everyDays} days`}</span
								>
								<button
									type="button"
									onclick={() => (draft.everyDays = Math.min(7, draft.everyDays + 1))}
									disabled={draft.everyDays >= 7}
									aria-label="More days"
									class="w-[38px] h-9 rounded-[9px] border-none bg-surface-3 cursor-pointer text-lg disabled:opacity-40"
									>+</button
								>
							</div>
						</div>
					{/if}

					<fieldset class="m-0 p-0 border-none flex flex-col gap-2">
						<legend class="p-0 mb-2 text-[15px]">When you miss a day</legend>
						{@render option(
							draft.keepOrder,
							"Keep the order",
							draft.pace === "gym-days"
								? "The routine waits for your next gym day"
								: "The routine waits for you; the rest moves back",
							() => (draft.keepOrder = true),
						)}
						{@render option(
							!draft.keepOrder,
							"Keep the dates",
							"Skip to whatever is due that day",
							() => (draft.keepOrder = false),
						)}
					</fieldset>
				{:else}
					<span class="-mt-2 text-xs text-faint"
						>The same days every week. Pick a routine for each day.</span
					>
					<ol class="m-0 p-0 list-none rounded-xl border-solid border-1 border-hairline bg-bg">
						{#each draft.days as id, i}
							<li
								class="flex items-center gap-3 h-[42px] pl-3.5 pr-1.5 border-b-solid border-b-1 border-b-divider-2 last:border-b-0"
							>
								<label for="split-day-{i}" class="w-[92px] text-[15px]">{plural[i]}</label>
								<span class="ml-auto flex items-center gap-2">
									{#if id !== null}<RoutineChip badge={badges.get(id)} />{/if}
									<select
										id="split-day-{i}"
										value={id === null ? "" : String(id)}
										onchange={(e) => setDay(i, e.currentTarget.value)}
										class="h-9 max-w-[150px] pl-2.5 pr-1.5 rounded-[10px] border-solid border-1 text-sm cursor-pointer outline-none focus:border-signal-ink {id ===
										null
											? 'bg-transparent border-transparent text-faint'
											: 'bg-surface-2 border-edge text-fg'}"
									>
										<option value="">Rest</option>
										{#each routines as routine (routine.id)}
											<option value={String(routine.id)}>{routine.name}</option>
										{/each}
									</select>
								</span>
							</li>
						{/each}
					</ol>

					<fieldset class="m-0 p-0 border-none flex flex-col gap-2">
						<legend class="p-0 mb-2 text-[15px]">When you miss a day</legend>
						{@render option(
							!draft.catchUp,
							"Skip it",
							"Carry on with whatever the next day has",
							() => (draft.catchUp = false),
						)}
						{@render option(
							draft.catchUp,
							"Catch up",
							"Do it on your next rest day; the other days stay",
							() => (draft.catchUp = true),
						)}
					</fieldset>
				{/if}

				<div class="md:hidden">{@render previewDays()}</div>
			</div>
		</div>

		<div class="flex gap-2 md:pt-4 md:border-t-solid md:border-t-1 md:border-t-divider">
			{#if original}
				<button
					type="button"
					onclick={remove}
					class="h-12 md:h-11 px-4 rounded-xl border-none cursor-pointer flex items-center gap-2 text-[15px] md:text-sm {confirmDelete
						? 'bg-destructive text-white'
						: 'bg-surface-3 text-danger'}"
				>
					<i class="i-tabler-trash block size-[18px] {confirmDelete ? 'text-white' : 'text-danger'}"
					></i>
					{confirmDelete ? "Tap again to delete" : "Delete"}
				</button>
			{/if}
			<span class="hidden md:block flex-1"></span>
			<button
				type="button"
				onclick={() => (showPopup = false)}
				class="hidden md:flex h-11 px-[18px] rounded-xl border-none bg-surface-3 cursor-pointer items-center text-sm"
				>Cancel</button
			>
			<button
				type="submit"
				disabled={!valid}
				class="flex-1 md:flex-none h-12 md:h-11 md:px-[22px] rounded-xl border-none bg-signal cursor-pointer text-[15px] md:text-sm font-semibold text-on-signal disabled:opacity-40 disabled:cursor-default"
			>
				{original ? "Save split" : "Create split"}
			</button>
		</div>
	</form>
</Popup>
