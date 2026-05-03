<script lang="ts">
	import { Button } from "bits-ui";

	let { cl = "", ...rest } = $props();
</script>

<Button.Root
	{...rest}
	class="block w-full text-center text-lg font-semibold text-fg-alt p-1.5 no-underline bg-muted rounded-lg {cl}"
><slot /></Button.Root>
