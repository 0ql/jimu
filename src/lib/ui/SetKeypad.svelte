<script lang="ts" module>
	export type KeypadKey =
		| "0"
		| "1"
		| "2"
		| "3"
		| "4"
		| "5"
		| "6"
		| "7"
		| "8"
		| "9"
		| "."
		| "x"
		| "a"
		| "d"
		| "space"
		| "back"
		| "enter"
		| "today";
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import { pushState } from "$app/navigation";
	import { page } from "$app/state";
	import { tapHaptic } from "#lib/haptics.js";

	let {
		title = "",
		todayLabel,
		todayDone = false,
		onkey,
		onabc,
		ondone,
	}: {
		title?: string;
		todayLabel: string;
		todayDone?: boolean;
		onkey: (key: KeypadKey) => void;
		onabc: () => void;
		ondone: () => void;
	} = $props();

	// The open keypad is a history entry, so the phone's Back button closes it instead of leaving
	// the page. Closing it any other way (Done, abc) takes that entry back out.
	let pushed = false;
	onMount(() => {
		pushState("", { ...page.state, keypad: true });
		return () => {
			if (page.state.keypad) history.back();
		};
	});
	$effect(() => {
		if (page.state.keypad) pushed = true;
		else if (pushed) ondone();
	});

	// The page pads its bottom by the keypad's height so nothing hides behind it.
	let height = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty("--pad-h", `${height}px`);
		return () => document.documentElement.style.setProperty("--pad-h", "0px");
	});

	// Press feedback: a key lights up the instant it is pressed and stays lit while held, for at
	// least MIN_LIT ms so even the quickest tap is visible, then fades out (see the style block).
	const MIN_LIT = 120;
	const pressedAt = new WeakMap<Element, number>();
	const light = (el: EventTarget | null) => {
		if (!(el instanceof HTMLElement)) return;
		pressedAt.set(el, performance.now());
		el.dataset.pressed = "";
		tapHaptic();
	};
	const unlight = (el: EventTarget | null) => {
		if (!(el instanceof HTMLElement) || !pressedAt.has(el)) return;
		const at = pressedAt.get(el)!;
		const wait = Math.max(0, MIN_LIT - (performance.now() - at));
		setTimeout(() => {
			// A new press of the same key in the meantime keeps it lit.
			if (pressedAt.get(el) !== at) return;
			pressedAt.delete(el);
			delete el.dataset.pressed;
		}, wait);
	};
	const flash = (el: EventTarget | null) => {
		light(el);
		unlight(el);
	};
	/** Highlight handlers for keys that act on click (abc, Done). */
	const lit = {
		onpointerdown: (e: PointerEvent) => light(e.currentTarget),
		onpointerup: (e: PointerEvent) => unlight(e.currentTarget),
		onpointercancel: (e: PointerEvent) => unlight(e.currentTarget),
		onpointerleave: (e: PointerEvent) => unlight(e.currentTarget),
	};

	// Hold backspace to keep deleting.
	let repeatDelay: ReturnType<typeof setTimeout> | undefined;
	let repeat: ReturnType<typeof setInterval> | undefined;
	const startBack = (e: PointerEvent) => {
		e.preventDefault();
		light(e.currentTarget);
		onkey("back");
		repeatDelay = setTimeout(() => (repeat = setInterval(() => onkey("back"), 70)), 400);
	};
	const stopBack = (e?: PointerEvent) => {
		clearTimeout(repeatDelay);
		clearInterval(repeat);
		if (e) unlight(e.currentTarget);
	};
	$effect(() => () => stopBack());

	// Keys never take focus from the log, so the caret stays where it is.
	const keepFocus = (e: MouseEvent) => e.preventDefault();

	// Keys fire on press, not on click: a phone drops the click when a second finger lands before
	// the first lifts (fast two-thumb typing) or reads quick taps as a double-tap. The click that
	// follows a touch is ignored; a keyboard "click" (Enter/Space, detail 0) still works.
	const press = (k: KeypadKey) => ({
		onpointerdown: (e: PointerEvent) => {
			if (e.button !== 0) return;
			e.preventDefault();
			light(e.currentTarget);
			onkey(k);
		},
		onpointerup: (e: PointerEvent) => unlight(e.currentTarget),
		onpointercancel: (e: PointerEvent) => unlight(e.currentTarget),
		onpointerleave: (e: PointerEvent) => unlight(e.currentTarget),
		onclick: (e: MouseEvent) => {
			if (e.detail !== 0) return;
			flash(e.currentTarget);
			onkey(k);
		},
	});

	const key =
		"h-full rounded-[10px] cursor-pointer flex items-center justify-center select-none touch-manipulation";
	const digit = `${key} border-none bg-keycap text-[24px] font-medium`;
	const symbol = `${key} border-none bg-surface-3 font-mono text-[20px] text-soft`;
</script>

<div
	bind:clientHeight={height}
	role="group"
	aria-label="Set keypad for {title}"
	data-keypad
	class="fixed left-0 right-0 bottom-0 z-30 bg-panel border-t-solid border-t-1 border-t-hairline"
	style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))"
>
	<!--
		[ 1 ][ 2 ][ 3 ][ backspace  ]
		[ 4 ][ 5 ][ 6 ][ a  ][ d    ]
		[ 7 ][ 8 ][ 9 ][ x  ][ abc  ]
		[ . ][ 0 ][ ↵ ][ today      ]
		[    space    ][ Done       ]
		Placed in this order; auto-placement fills the five rows.
	-->
	<div
		class="max-w-[480px] mx-auto px-2 pt-2 grid grid-cols-5 gap-1.5"
		style="grid-template-rows: repeat(5, 48px)"
	>
		{#each ["1", "2", "3"] as const as k}
			<button onmousedown={keepFocus} {...press(k)} class={digit}>{k}</button>
		{/each}
		<button
			onpointerdown={startBack}
			onpointerup={stopBack}
			onpointerleave={stopBack}
			onpointercancel={stopBack}
			onkeydown={(e) => {
				if (e.key !== "Enter" && e.key !== " ") return;
				flash(e.currentTarget);
				onkey("back");
			}}
			aria-label="Backspace"
			class="{symbol} col-span-2"
		>
			<i class="i-tabler-backspace block size-6 text-soft"></i>
		</button>

		{#each ["4", "5", "6"] as const as k}
			<button onmousedown={keepFocus} {...press(k)} class={digit}>{k}</button>
		{/each}
		<button
			onmousedown={keepFocus}
			{...press("a")}
			aria-label="Warm-up set"
			class="{key} bg-transparent border-dashed border-1 border-ghost font-mono text-[20px] text-soft"
			>a</button
		>
		<button
			onmousedown={keepFocus}
			{...press("d")}
			aria-label="Drop set"
			class="{key} bg-drop-bg border-solid border-1 border-drop-border font-mono text-[20px] text-drop"
			>d</button
		>

		{#each ["7", "8", "9"] as const as k}
			<button onmousedown={keepFocus} {...press(k)} class={digit}>{k}</button>
		{/each}
		<button onmousedown={keepFocus} {...press("x")} aria-label="times" class={symbol}>x</button>
		<button
			onmousedown={keepFocus}
			{...lit}
			onclick={onabc}
			aria-label="Switch to full keyboard"
			class="{key} border-none bg-surface-3 text-sm font-semibold text-soft">abc</button
		>

		<button onmousedown={keepFocus} {...press(".")} aria-label="Decimal point" class={digit}
			>.</button
		>
		<button onmousedown={keepFocus} {...press("0")} class={digit}>0</button>
		<button onmousedown={keepFocus} {...press("enter")} aria-label="New line" class={symbol}>
			<i class="i-tabler-corner-down-left block size-6 text-soft"></i>
		</button>
		<button
			onmousedown={keepFocus}
			{...press("today")}
			aria-label="Start today's line"
			class="{symbol} col-span-2 gap-1 text-[15px] {todayDone ? 'text-faint' : 'text-signal-ink'}"
		>
			<i class="i-tabler-plus block size-4 {todayDone ? 'text-faint' : 'text-signal-ink'}"></i>
			{todayLabel}
		</button>

		<button
			onmousedown={keepFocus}
			{...press("space")}
			aria-label="Space"
			class="{symbol} col-span-3"
		>
			<i class="i-tabler-space block size-6 text-soft"></i>
		</button>
		<button
			onmousedown={keepFocus}
			{...lit}
			onclick={ondone}
			class="{key} col-span-2 border-none bg-surface-3 gap-1.5 text-[15px] font-semibold text-fg"
		>
			<i class="i-tabler-chevron-down block size-5"></i>
			Done
		</button>
	</div>
</div>

<style>
	/* Keys: instant highlight on press, smooth fade on release. The inset shadow brightens every
	   key style, including the outlined (transparent) warm-up key. */
	button {
		transition:
			transform 180ms ease-out,
			box-shadow 220ms ease-out;
	}
	button:global([data-pressed]) {
		transform: scale(0.93);
		box-shadow: inset 0 0 0 100px var(--press);
		transition: none;
	}
	@media (prefers-reduced-motion: reduce) {
		button:global([data-pressed]) {
			transform: none;
		}
	}
</style>
