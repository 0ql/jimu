<script lang="ts">
	import { Tabs } from "bits-ui";
	import Airplane from "phosphor-svelte/lib/Airplane";
</script>

<!-- class="rounded-card border-muted bg-foreground p-3" -->
<Tabs.Root
	value="outbound"
>
	<!-- class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30" -->
	<Tabs.List
	>
		<!-- class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white" -->
		<Tabs.Trigger
			value="outbound"
			>Outbound</Tabs.Trigger
		>
		<!-- class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white" -->
		<Tabs.Trigger
			value="inbound"
			>Inbound</Tabs.Trigger
		>
	</Tabs.List>
	<Tabs.Content value="outbound" class="select-none pt-3"></Tabs.Content>
	<Tabs.Content value="inbound" class="select-none pt-3"></Tabs.Content>
</Tabs.Root>
