<script lang="ts">
	export type ChartPoint = { date: Date; value: number; detail: string };

	let {
		points,
		label,
		format,
	}: { points: ChartPoint[]; label: string; format: (n: number) => string } = $props();

	const HEIGHT = 260;
	const PAD = { top: 18, right: 80, bottom: 30, left: 52 };

	/** Axis ticks carry only the number; the chart's subtitle names the unit. */
	const tickText = (n: number) =>
		String(Math.round(n * 10) / 10)
			.replace(".", ",")
			.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");

	let width = $state(0);
	let active: number | null = $state(null);

	const innerW = $derived(Math.max(1, width - PAD.left - PAD.right));
	const innerH = HEIGHT - PAD.top - PAD.bottom;

	/** Clean y ticks around the data (not forced to zero, so progress stays visible). */
	const yScale = $derived.by(() => {
		const values = points.map((p) => p.value);
		let lo = Math.min(...values);
		let hi = Math.max(...values);
		if (lo === hi) {
			lo -= Math.max(1, Math.abs(lo) * 0.1);
			hi += Math.max(1, Math.abs(hi) * 0.1);
		}
		const raw = (hi - lo) / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
		const min = Math.max(0, Math.floor(lo / step) * step);
		const max = Math.ceil(hi / step) * step;
		const ticks = [];
		for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
		return { min, max, ticks };
	});

	const xRange = $derived.by(() => {
		const times = points.map((p) => p.date.getTime());
		return { min: Math.min(...times), max: Math.max(...times) };
	});

	const x = (d: Date) =>
		xRange.max === xRange.min
			? PAD.left + innerW / 2
			: PAD.left + ((d.getTime() - xRange.min) / (xRange.max - xRange.min)) * innerW;
	const y = (v: number) =>
		PAD.top + innerH - ((v - yScale.min) / (yScale.max - yScale.min || 1)) * innerH;

	const coords = $derived(points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) })));
	const line = $derived(coords.map((c, i) => `${i ? "L" : "M"}${c.cx},${c.cy}`).join(""));
	const area = $derived(
		coords.length
			? `${line}L${coords.at(-1)!.cx},${PAD.top + innerH}L${coords[0].cx},${PAD.top + innerH}Z`
			: "",
	);

	const xTicks = $derived.by(() => {
		if (!points.length) return [];
		const span = xRange.max - xRange.min;
		const count = Math.max(2, Math.min(5, Math.floor(innerW / 110)));
		const short = span < 120 * 86400000;
		const seen = new Set<string>();
		const ticks = [];
		for (let i = 0; i < count; i++) {
			const date = new Date(xRange.min + (span * i) / (count - 1 || 1));
			const text = short
				? date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
				: date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
			if (seen.has(text)) continue;
			seen.add(text);
			ticks.push({ cx: x(date), text });
		}
		return ticks;
	});

	const showDots = $derived(points.length <= 40);
	const last = $derived(coords.at(-1));
	const current = $derived(active === null ? null : coords[active]);

	const nearest = (px: number) => {
		let best = 0;
		for (let i = 1; i < coords.length; i++) {
			if (Math.abs(coords[i].cx - px) < Math.abs(coords[best].cx - px)) best = i;
		}
		return best;
	};
	const onMove = (e: PointerEvent) => {
		const box = (e.currentTarget as SVGElement).getBoundingClientRect();
		active = nearest(e.clientX - box.left);
	};
	const onKey = (e: KeyboardEvent) => {
		if (!coords.length) return;
		if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
			e.preventDefault();
			const start = active ?? coords.length - 1;
			active = Math.min(coords.length - 1, Math.max(0, start + (e.key === "ArrowRight" ? 1 : -1)));
		} else if (e.key === "Escape") {
			active = null;
		}
	};
	const dateText = (d: Date) =>
		d.toLocaleDateString("de-DE", {
			weekday: "short",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
</script>

<div bind:clientWidth={width} class="relative w-full" style="height: {HEIGHT}px">
	{#if width && points.length}
		<!-- The chart is a focusable widget: arrow keys step through sessions, so screen readers
		     get it as an application with a summary label, and the sessions table is the full text view. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<svg
			{width}
			height={HEIGHT}
			role="application"
			tabindex="0"
			aria-label="{label} over {points.length} sessions, from {format(points[0].value)} to {format(
				points.at(-1)!.value,
			)}. Use the left and right arrow keys to read each session."
			class="block outline-none focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-solid rounded-lg"
			onpointermove={onMove}
			onpointerleave={() => (active = null)}
			onkeydown={onKey}
			onblur={() => (active = null)}
		>
			{#each yScale.ticks as tick}
				<line
					x1={PAD.left}
					x2={PAD.left + innerW}
					y1={y(tick)}
					y2={y(tick)}
					stroke="#26262b"
					stroke-width="1"
				/>
				<text
					x={PAD.left - 10}
					y={y(tick)}
					text-anchor="end"
					dominant-baseline="middle"
					class="fill-[#7c7c85] font-mono text-[11px]">{tickText(tick)}</text
				>
			{/each}
			{#each xTicks as tick}
				<text
					x={tick.cx}
					y={HEIGHT - 8}
					text-anchor="middle"
					class="fill-[#7c7c85] font-mono text-[11px]">{tick.text}</text
				>
			{/each}

			<path d={area} fill="#d7f55a" fill-opacity="0.1" />
			<path
				d={line}
				fill="none"
				stroke="#d7f55a"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>

			{#if showDots}
				{#each coords as c}
					<circle cx={c.cx} cy={c.cy} r="4" fill="#d7f55a" stroke="#17171a" stroke-width="2" />
				{/each}
			{:else if last}
				<circle cx={last.cx} cy={last.cy} r="4" fill="#d7f55a" stroke="#17171a" stroke-width="2" />
			{/if}
			{#if last && !current}
				<text
					x={last.cx + 10}
					y={last.cy}
					dominant-baseline="middle"
					class="fill-[#f2f1ec] font-mono text-xs font-medium">{format(last.value)}</text
				>
			{/if}

			{#if current}
				<line
					x1={current.cx}
					x2={current.cx}
					y1={PAD.top}
					y2={PAD.top + innerH}
					stroke="#55555e"
					stroke-width="1"
				/>
				<circle
					cx={current.cx}
					cy={current.cy}
					r="6"
					fill="#d7f55a"
					stroke="#17171a"
					stroke-width="2"
				/>
			{/if}
		</svg>

		{#if current}
			<div
				class="pointer-events-none absolute z-10 min-w-[160px] max-w-[260px] px-3 py-2 rounded-lg bg-[#232328] border-solid border-1 border-[#34343b] shadow-lg flex flex-col gap-0.5"
				style="left: {Math.min(Math.max(current.cx, 90), width - 90)}px; top: {Math.max(
					current.cy - 12,
					0,
				)}px; transform: translate(-50%, -100%)"
			>
				<span class="font-semibold text-[15px]">{format(current.value)}</span>
				<span class="text-xs text-subtle">{dateText(current.date)}</span>
				<span class="font-mono text-xs text-[#c9c9cf] truncate">{current.detail}</span>
			</div>
		{/if}
	{/if}
</div>
