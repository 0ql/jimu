<script lang="ts">
	const credentials = $state({
		username: "",
		password: "",
	});

	const login = async () => {
		const res = await fetch("/login", {
			method: "POST",
			body: JSON.stringify(credentials),
		});

		if (res.status !== 200) alert("error logging in");
	};
</script>

<input bind:value={credentials.username} type="text" />
<input bind:value={credentials.password} type="text" />
<button onclick={login}>Login</button>
