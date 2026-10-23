import type { LayoutServerLoad } from "./$types";

// The nav shows the admin link only to admins; the admin page checks again on its own.
// userUuid lets the client check that its local data belongs to the signed-in account.
export const load: LayoutServerLoad = ({ locals }) => ({
	isAdmin: locals.user?.isAdmin ?? false,
	userUuid: locals.user?.uuid ?? "",
});
