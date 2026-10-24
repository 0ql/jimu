import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// Passed through to vite-plugin-svelte: runes mode for our own components only.
			dynamicCompileOptions: ({ filename }) =>
				filename.includes("node_modules") ? undefined : { runes: true },
		}),
		// SvelteKit doesn't run Vite's transformIndexHtml hook (there is no index.html; the styles
		// come in through `import "virtual:uno.css"`), so drop it from UnoCSS's plugins to avoid
		// a warning on every start.
		...UnoCSS().map(({ transformIndexHtml: _unused, ...plugin }) => plugin),
	],
	build: {
		rolldownOptions: {
			onLog(level, log, handler) {
				// "virtual:uno.css" is imported once (src/routes/+layout.svelte), but the client build
				// resolves that same import twice and UnoCSS warns on any repeat, whoever imports it.
				if (log.plugin?.startsWith("unocss") && log.message.includes("imported multiple times"))
					return;
				handler(level, log);
			},
		},
	},
});
