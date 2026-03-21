<script lang="ts">
	import { Tabs } from "bits-ui";
	let text = "test";
</script>

<main class="p-4">
	<Tabs.Root value="outbound" class="">
		<Tabs.List class="flex bg-card rounded gap-3 p-2">
			<Tabs.Trigger
				value="outbound"
				class="data-[state=active]:bg-card-fg data-[state=active]:text-card text-card-fg bg-card w-full p-3 text-xl rounded-lg border-none"
				>Outbound</Tabs.Trigger
			>
			<Tabs.Trigger
				value="inbound"
				class="data-[state=active]:bg-card-fg data-[state=active]:text-card text-card-fg bg-card w-full p-3 text-xl rounded-lg border-none"
				>Inbound</Tabs.Trigger
			>
		</Tabs.List>
		<Tabs.Content class="p-2 max-h-[80vh] overflow-y-scroll" value="outbound">
			<textarea
				class="w-full bg-transparent border-none text-current"
				bind:value={text}
			/>
		</Tabs.Content>
		<Tabs.Content value="inbound"></Tabs.Content>
	</Tabs.Root>
</main>
