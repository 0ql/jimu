import { page } from "$app/state";

/** The account's weight unit ("kg" or "lb"), from the layout data; kg when signed out. */
export const unit = (): "kg" | "lb" => (page.data.unit === "lb" ? "lb" : "kg");
