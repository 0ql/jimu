<script lang="ts">
	let { cl = "", children, ...rest } = $props();
</script>

<h2 {...rest} class="text-xs uppercase tracking-wide text-fg-alt m-0 mb-3 {cl}">
	{@render children?.()}
</h2>
