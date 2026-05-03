<script lang="ts">
	let { cl = "", ...rest } = $props();
</script>

<a
	{...rest}
	class="block w-full text-center text-lg font-semibold text-fg-alt p-1.5 no-underline bg-muted rounded-lg {cl}"
	><slot /></a
>
