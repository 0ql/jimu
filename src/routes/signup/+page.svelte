<script lang="ts">
	import { goto } from "$app/navigation";
	import { Button } from "bits-ui";

	const credentials = $state({
		username: "",
		password1: "",
		password2: "",
	});

	const signup = async () => {
		if (credentials.password1 !== credentials.password2) {
			alert("passwords don't match");
			return;
		}

		const res = await fetch("/signup", {
			method: "POST",
			body: JSON.stringify({
				username: credentials.username,
				password: credentials.password2,
			}),
		});

		if (res.status !== 200) {
			alert("somthing failed");
			return;
		}

		goto("/login");
	};
</script>

<main class="flex justify-center items-center w-full h-100dvh">
	<section
		class="max-w-100 bg-bg-alt border-solid border-1 rounded-lg border-border-card px-4 pb-3"
	>
		<h1 class="text-lg font-bold">Sign Up to jimu</h1>
		<input
			class="w-full p-3 rounded-lg bg-bg border-solid border-1 border-border-input"
			placeholder="Username"
			bind:value={credentials.username}
			type="text"
		/>
		<input
			class="w-full p-3 rounded-lg bg-bg border-solid border-1 border-border-input mt-3"
			placeholder="Enter Password..."
			bind:value={credentials.password1}
			type="password"
		/>
		<input
			class="w-full p-3 rounded-lg bg-bg border-solid border-1 border-border-input mt-3"
			placeholder="Enter Password again..."
			bind:value={credentials.password2}
			type="password"
		/>
		<Button.Root
			onclick={signup}
			class="w-full mt-3 bg-dark text-bg rounded-lg p-1.5 text-lg font-semibold border-none"
			>Sign Up</Button.Root
		>
	</section>
</main>
