import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// SvelteKit 3 replaced $lib with #lib subpath imports; this keeps the existing $lib imports working.
			alias: { $lib: "src/lib" },
			// Passed through to vite-plugin-svelte: runes mode for our own components only.
			dynamicCompileOptions: ({ filename }) =>
				filename.includes("node_modules") ? undefined : { runes: true },
		}),
		UnoCSS(),
	],
});
