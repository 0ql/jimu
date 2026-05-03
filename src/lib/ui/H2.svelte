<script lang="ts">
	let { cl = "", ...rest } = $props();
</script>

<h2 {...rest} class="text-xs uppercase tracking-wide text-fg-alt m-0 mb-3 {cl}">
	<slot />
</h2>
