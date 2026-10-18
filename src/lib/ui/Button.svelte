<script lang="ts">
	let { cl = "", children, ...rest } = $props();
</script>

<button
	{...rest}
	class="w-full bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none {cl}"
	>{@render children?.()}</button
>
