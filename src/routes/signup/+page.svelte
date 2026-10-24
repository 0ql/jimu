<script lang="ts">
	import { goto } from "$app/navigation";
	import AuthShell from "../AuthShell.svelte";
	import AuthField from "../AuthField.svelte";

	const credentials = $state({
		username: "",
		password1: "",
		password2: "",
	});

	let error = $state("");
	let loading = $state(false);

	const validate = (): string => {
		if (!credentials.username.trim()) return "Username is required";
		if (credentials.username.length < 3) return "Username must be at least 3 characters";
		if (credentials.username.length > 30) return "Username must be at most 30 characters";
		if (!/^[a-zA-Z0-9_-]+$/.test(credentials.username))
			return "Username can only contain letters, numbers, _ and -";
		if (!credentials.password1) return "Password is required";
		if (credentials.password1.length < 8) return "Password must be at least 8 characters";
		if (credentials.password1 !== credentials.password2) return "Passwords don't match";
		return "";
	};

	const signup = async () => {
		error = validate();
		if (error) return;

		loading = true;
		try {
			const res = await fetch("/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: credentials.username,
					password: credentials.password2,
				}),
			}).catch(() => null);

			if (!res) {
				error = "You're offline. Creating an account needs a connection.";
				return;
			}
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				error = data.error ?? "Something went wrong";
				return;
			}

			goto("/login");
		} finally {
			loading = false;
		}
	};
</script>

<AuthShell title="Create account" {error} onsubmit={signup}>
	<AuthField
		id="username"
		label="Username"
		bind:value={credentials.username}
		autocomplete="username"
		hint="3–30 characters: letters, numbers, _ and -"
	/>
	<AuthField
		id="password"
		label="Password"
		type="password"
		bind:value={credentials.password1}
		autocomplete="new-password"
		hint="At least 8 characters"
	/>
	<AuthField
		id="password-confirm"
		label="Confirm password"
		type="password"
		bind:value={credentials.password2}
		autocomplete="new-password"
	/>
	<button
		type="submit"
		disabled={loading}
		class="h-12 mt-1 rounded-xl border-none bg-signal cursor-pointer text-[15px] font-semibold text-on-signal disabled:opacity-60 disabled:cursor-default"
	>
		{loading ? "Creating account…" : "Create account"}
	</button>
	{#snippet footer()}
		Already have an account? <a
			href="/login"
			data-plain
			class="font-semibold no-underline text-signal-ink">Log in</a
		>
	{/snippet}
</AuthShell>
