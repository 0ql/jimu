// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: { uuid: string; isAdmin: boolean };
		}
		// interface PageData {}
		interface PageState {
			/** The exercise open as a page on phones (shallow routing over the list). */
			exercise?: number;
			/** The set keypad is open; Back closes it. */
			keypad?: boolean;
		}
		// interface Platform {}
	}
}

export {};
