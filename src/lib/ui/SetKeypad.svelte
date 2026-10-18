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

	// The page pads its bottom by the keypad's height so nothing hides behind it.
	let height = $state(0);
	$effect(() => {
		document.documentElement.style.setProperty("--pad-h", `${height}px`);
		return () => document.documentElement.style.setProperty("--pad-h", "0px");
	});

	// Hold backspace to keep deleting.
	let repeatDelay: ReturnType<typeof setTimeout> | undefined;
	let repeat: ReturnType<typeof setInterval> | undefined;
	const startBack = (e: PointerEvent) => {
		e.preventDefault();
		onkey("back");
		repeatDelay = setTimeout(() => (repeat = setInterval(() => onkey("back"), 70)), 400);
	};
	const stopBack = () => {
		clearTimeout(repeatDelay);
		clearInterval(repeat);
	};
	$effect(() => stopBack);

	// Keys never take focus from the log, so the caret stays where it is.
	const keepFocus = (e: MouseEvent) => e.preventDefault();

	const key =
		"h-[52px] rounded-[10px] cursor-pointer flex items-center justify-center select-none touch-manipulation active:brightness-140";
	const digit = `${key} border-none bg-[#2c2c30] text-[24px] font-medium`;
	const symbol = `${key} border-none bg-surface-3 font-mono text-[20px] text-[#c9c9cf]`;
</script>

<div
	bind:clientHeight={height}
	role="group"
	aria-label="Set keypad"
	class="fixed left-0 right-0 bottom-0 z-30 bg-[#141416] border-t-solid border-t-1 border-t-hairline"
	style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))"
>
	<div class="max-w-[480px] mx-auto px-2 pt-1.5 flex flex-col gap-1.5">
		<div class="flex items-center gap-1.5 h-10 pl-1.5">
			<span class="flex-1 min-w-0 truncate text-[13px] text-subtle">{title}</span>
			<button
				onmousedown={keepFocus}
				onclick={onabc}
				aria-label="Switch to full keyboard"
				class="h-9 px-3 rounded-lg border-none bg-transparent cursor-pointer text-[13px] font-semibold text-[#c9c9cf]"
				>abc</button
			>
			<button
				onmousedown={keepFocus}
				onclick={ondone}
				class="h-9 px-3 rounded-lg border-none bg-surface-3 cursor-pointer flex items-center gap-1 text-sm font-semibold"
			>
				Done
				<i class="i-tabler-chevron-down block size-4"></i>
			</button>
		</div>

		<div class="grid grid-cols-5 gap-1.5">
			{#each ["1", "2", "3"] as const as k}
				<button onmousedown={keepFocus} onclick={() => onkey(k)} class={digit}>{k}</button>
			{/each}
			<button onmousedown={keepFocus} onclick={() => onkey("x")} aria-label="times" class={symbol}
				>x</button
			>
			<button
				onpointerdown={startBack}
				onpointerup={stopBack}
				onpointerleave={stopBack}
				onpointercancel={stopBack}
				onkeydown={(e) => (e.key === "Enter" || e.key === " ") && onkey("back")}
				aria-label="Backspace"
				class={symbol}
			>
				<i class="i-tabler-backspace block size-6 text-[#c9c9cf]"></i>
			</button>

			{#each ["4", "5", "6"] as const as k}
				<button onmousedown={keepFocus} onclick={() => onkey(k)} class={digit}>{k}</button>
			{/each}
			<button
				onmousedown={keepFocus}
				onclick={() => onkey("a")}
				aria-label="Warm-up set"
				class="{key} bg-transparent border-dashed border-1 border-[#4a4a52] font-mono text-[20px] text-[#c9c9cf]"
				>a</button
			>
			<button
				onmousedown={keepFocus}
				onclick={() => onkey("d")}
				aria-label="Drop set"
				class="{key} bg-drop-bg border-solid border-1 border-drop-border font-mono text-[20px] text-drop"
				>d</button
			>

			{#each ["7", "8", "9"] as const as k}
				<button onmousedown={keepFocus} onclick={() => onkey(k)} class={digit}>{k}</button>
			{/each}
			<button
				onmousedown={keepFocus}
				onclick={() => onkey("space")}
				aria-label="Space"
				class="{symbol} col-span-2"
			>
				<i class="i-tabler-space block size-6 text-[#c9c9cf]"></i>
			</button>

			<button
				onmousedown={keepFocus}
				onclick={() => onkey(".")}
				aria-label="Decimal point"
				class={digit}>.</button
			>
			<button onmousedown={keepFocus} onclick={() => onkey("0")} class={digit}>0</button>
			<button
				onmousedown={keepFocus}
				onclick={() => onkey("enter")}
				aria-label="New line"
				class={symbol}
			>
				<i class="i-tabler-corner-down-left block size-6 text-[#c9c9cf]"></i>
			</button>
			<button
				onmousedown={keepFocus}
				onclick={() => onkey("today")}
				aria-label="Start today's line"
				class="{symbol} col-span-2 gap-1 text-[15px] {todayDone ? 'text-faint' : 'text-signal'}"
			>
				<i class="i-tabler-plus block size-4 {todayDone ? 'text-faint' : 'text-signal'}"></i>
				{todayLabel}
			</button>
		</div>
	</div>
</div>
