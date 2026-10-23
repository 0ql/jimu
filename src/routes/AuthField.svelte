<script lang="ts">
	import type { FullAutoFill } from "svelte/elements";

	let {
		id,
		label,
		value = $bindable(""),
		type = "text",
		autocomplete,
		hint = "",
	}: {
		id: string;
		label: string;
		value?: string;
		type?: "text" | "password";
		autocomplete: FullAutoFill;
		hint?: string;
	} = $props();

	let visible = $state(false);
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-xs text-subtle">{label}</label>
	<div class="relative">
		<input
			{id}
			bind:value
			type={type === "password" && !visible ? "password" : "text"}
			{autocomplete}
			autocapitalize="none"
			spellcheck="false"
			class="h-[50px] w-full rounded-xl border-solid border-1 border-[#34343b] bg-bg px-3.5 text-base outline-none focus:border-signal {type ===
			'password'
				? 'pr-12'
				: ''}"
		/>
		{#if type === "password"}
			<button
				type="button"
				onclick={() => (visible = !visible)}
				aria-label={visible ? "Hide password" : "Show password"}
				aria-pressed={visible}
				class="absolute right-1.5 top-1/2 -translate-y-1/2 size-10 rounded-lg border-none bg-transparent cursor-pointer flex items-center justify-center"
			>
				<i class="{visible ? 'i-tabler-eye-off' : 'i-tabler-eye'} block size-5 text-subtle"></i>
			</button>
		{/if}
	</div>
	{#if hint}
		<span class="text-xs text-faint">{hint}</span>
	{/if}
</div>
