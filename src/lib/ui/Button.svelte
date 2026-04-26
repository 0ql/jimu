<script lang="ts">
	import { Button } from "bits-ui";

	let { cl = "", ...rest } = $props();
</script>

<Button.Root
	{...rest}
	class="w-full mt-3 bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none {cl}"
	><slot /></Button.Root
>
