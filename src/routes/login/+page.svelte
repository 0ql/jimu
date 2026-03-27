<script lang="ts">
	import { goto } from "$app/navigation";
	import { Button } from "bits-ui";

	const credentials = $state({
		username: "",
		password: "",
	});

	const login = async () => {
		const res = await fetch("/login", {
			method: "POST",
			body: JSON.stringify(credentials),
		});

		if (res.status !== 200) {
			alert("error logging in");
			return;
		}
		goto("/");
	};
</script>

<main class="flex justify-center items-center w-full h-100dvh">
	<section
		class="max-w-100 bg-bg-alt border-solid border-1 rounded-lg border-border-card px-4 pb-3"
	>
		<h1 class="text-lg font-bold">Login to jimu</h1>
		<input
			class="w-full p-3 rounded-lg bg-bg border-solid border-1 border-border-input"
			placeholder="Username"
			bind:value={credentials.username}
			type="text"
		/>
		<input
			class="w-full p-3 rounded-lg bg-bg border-solid border-1 border-border-input mt-3"
			placeholder="Password"
			bind:value={credentials.password}
			type="password"
		/>
		<Button.Root
			onclick={login}
			class="w-full mt-3 bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none"
			>Login</Button.Root
		>
	</section>
</main>
