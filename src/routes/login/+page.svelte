<script lang="ts">
	import { goto } from "$app/navigation";
	import Anchor from "$lib/ui/Anchor.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import Input from "$lib/ui/Input.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";

	const credentials = $state({
		username: "",
		password: "",
	});

	let error = $state("");
	let loading = $state(false);

	const login = async () => {
		error = "";
		loading = true;
		try {
			const res = await fetch("/login", {
				method: "POST",
				body: JSON.stringify(credentials),
			});

			if (res.status !== 200) {
				error = "Invalid username or password";
				return;
			}
			goto("/");
		} finally {
			loading = false;
		}
	};
</script>

<main
	class="flex flex-col justify-center items-center w-full min-h-screen gap-8 px-4 relative overflow-hidden"
>
	<PageTitle cl="text-7xl">JIMU</PageTitle>

	<section
		class="relative w-full max-w-sm bg-bg-alt border-solid border-1 border-muted rounded-xl px-6 py-6 overflow-hidden"
	>
		<p class="text-xs uppercase tracking-widest text-fg-alt mb-4 m-0">Sign in to continue</p>
		<Input placeholder="Username" bind:value={credentials.username} type="text" />
		<Input
			placeholder="Password"
			bind:value={credentials.password}
			type="password"
			cl="mt-3"
			onkeydown={(e: KeyboardEvent) => e.key === "Enter" && login()}
		/>

		{#if error}
			<p class="text-xs text-destructive mt-3 m-0 text-center uppercase tracking-widest font-bold">
				{error}
			</p>
		{/if}

		<Btn onclick={login} cl="bg-destructive cursor-pointer mt-4 text-white" disabled={loading}>
			{loading ? "Logging in..." : "Login"}
		</Btn>
		<Anchor href="/signup" cl="mt-2">No account? Sign up</Anchor>
	</section>
</main>
