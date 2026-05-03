<script lang="ts">
	let { cl = "", ...rest } = $props();
</script>

<button
	{...rest}
	class="w-full mt-3 bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none {cl}"
	><slot /></button
>
