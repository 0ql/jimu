<script lang="ts">
	let { cl = "", children, ...rest } = $props();
</script>

<p {...rest} class="text-sm text-fg-alt m-0 {cl}">{@render children?.()}</p>
