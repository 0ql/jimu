<script lang="ts">
	let { cl = "", ...rest } = $props();
</script>

<p {...rest} class="text-sm text-fg-alt m-0 {cl}"><slot /></p>
