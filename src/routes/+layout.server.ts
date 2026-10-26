import type { LayoutServerLoad } from "./$types";

// The nav shows the admin link only to admins; the admin page checks again on its own.
// userUuid lets the client check that its local data belongs to the signed-in account.
// unit is the account's weight unit, for every label that shows one.
export const load: LayoutServerLoad = ({ locals }) => ({
	isAdmin: locals.user?.isAdmin ?? false,
	userUuid: locals.user?.uuid ?? "",
	unit: locals.user?.unit ?? "kg",
});
