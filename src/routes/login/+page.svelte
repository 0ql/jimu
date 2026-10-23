<script lang="ts">
	import { goto } from "$app/navigation";
	import AuthShell from "../AuthShell.svelte";
	import AuthField from "../AuthField.svelte";

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
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(credentials),
			});

			if (res.status !== 200) {
				error = "That username and password don't match.";
				return;
			}
			// invalidateAll reloads layout data (e.g. the admin flag) for the account that just logged in.
			goto("/", { invalidateAll: true });
		} finally {
			loading = false;
		}
	};
</script>

<svelte:head><title>Log in · jimu</title></svelte:head>

<AuthShell title="Log in" {error} onsubmit={login}>
	<AuthField
		id="username"
		label="Username"
		bind:value={credentials.username}
		autocomplete="username"
	/>
	<AuthField
		id="password"
		label="Password"
		type="password"
		bind:value={credentials.password}
		autocomplete="current-password"
	/>
	<button
		type="submit"
		disabled={loading}
		class="h-12 mt-1 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-[#111] disabled:opacity-60 disabled:cursor-default"
	>
		{loading ? "Logging in…" : "Log in"}
	</button>
	{#snippet footer()}
		No account yet? <a href="/signup" class="font-semibold no-underline text-signal">Create one</a>
	{/snippet}
</AuthShell>
