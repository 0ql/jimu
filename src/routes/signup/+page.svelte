<script lang="ts">
	import { goto } from "$app/navigation";
	import Input from "$lib/ui/Input.svelte";
	import Btn from "$lib/ui/Button.svelte";
	import Anchor from "$lib/ui/Anchor.svelte";
	import PageTitle from "$lib/ui/PageTitle.svelte";

	const credentials = $state({
		username: "",
		password1: "",
		password2: "",
	});

	let error = $state("");
	let loading = $state(false);

	const validate = (): string => {
		if (!credentials.username.trim()) return "Username is required";
		if (credentials.username.length < 3)
			return "Username must be at least 3 characters";
		if (credentials.username.length > 30)
			return "Username must be at most 30 characters";
		if (!/^[a-zA-Z0-9_-]+$/.test(credentials.username))
			return "Username can only contain letters, numbers, _ and -";
		if (!credentials.password1) return "Password is required";
		if (credentials.password1.length < 8)
			return "Password must be at least 8 characters";
		if (credentials.password1 !== credentials.password2)
			return "Passwords don't match";
		return "";
	};

	const signup = async () => {
		error = validate();
		if (error) return;

		loading = true;
		try {
			const res = await fetch("/signup", {
				method: "POST",
				body: JSON.stringify({
					username: credentials.username,
					password: credentials.password2,
				}),
			});

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

<main
	class="flex flex-col justify-center items-center w-full min-h-screen gap-8 px-4"
>
	<PageTitle cl="text-7xl">JIMU</PageTitle>

	<section
		class="w-full max-w-sm bg-bg-alt border-solid border-1 border-muted rounded-xl px-6 py-6"
	>
		<p class="text-xs uppercase tracking-widest text-fg-alt mb-4 m-0">
			Create an account
		</p>
		<Input
			placeholder="Username"
			bind:value={credentials.username}
			type="text"
		/>
		<Input
			placeholder="Password"
			bind:value={credentials.password1}
			type="password"
			cl="mt-3"
		/>
		<Input
			placeholder="Confirm password"
			bind:value={credentials.password2}
			type="password"
			cl="mt-3"
			onkeydown={(e) => e.key === "Enter" && signup()}
		/>

		{#if error}
			<p
				class="text-xs text-destructive mt-3 m-0 text-center uppercase tracking-widest font-bold"
			>
				{error}
			</p>
		{/if}

		<Btn
			onclick={signup}
			cl="bg-destructive cursor-pointer mt-4 text-white"
			disabled={loading}
		>
			{loading ? "Signing up..." : "Sign Up"}
		</Btn>
		<Anchor href="/login" cl="mt-2">Already have an account? Login</Anchor>
	</section>
</main>
