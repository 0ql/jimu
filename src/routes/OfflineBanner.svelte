<script lang="ts">
	import { online } from "$lib/network";

	// While it shows, the bars below make room for it via --offline-h (Nav, ExercisePage).
	$effect(() => {
		document.documentElement.style.setProperty("--offline-h", $online ? "0px" : "32px");
	});
</script>

{#if !$online}
	<!-- Colors are set on each part because main.css gives every element the foreground color. -->
	<div
		role="status"
		class="fixed left-0 right-0 top-0 z-[45] bg-[var(--warn-bg)] border-b-solid border-b-1 border-b-[var(--warn-edge)]"
		style="padding-top: env(safe-area-inset-top)"
	>
		<div class="h-[31px] px-4 flex items-center justify-center gap-2 text-[13px] min-w-0">
			<i class="i-tabler-cloud-off block size-4 shrink-0 text-[var(--warn)]"></i>
			<span class="font-semibold text-[var(--warn)] shrink-0">Offline</span>
			<span class="text-[var(--warn)] truncate"
				>· changes stay on this device and sync when you're back</span
			>
		</div>
	</div>
{/if}
