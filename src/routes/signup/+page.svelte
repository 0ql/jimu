<script lang="ts">
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

		if (res.status !== 200) alert("somthing failed");
	};
</script>

<input bind:value={credentials.username} type="text" placeholder="Username" />
<input
	bind:value={credentials.password1}
	type="password"
	placeholder="Enter Password..."
/>
<input
	bind:value={credentials.password2}
	type="password"
	placeholder="Enter Password again..."
/>
<button onclick={signup}>Signup</button>
