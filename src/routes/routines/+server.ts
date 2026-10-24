import { loadStore, saveStore } from "#lib/server/syncStore.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = ({ request, locals }) =>
	saveStore("routines", locals.user.uuid, request);

export const GET: RequestHandler = ({ locals }) => loadStore("routines", locals.user.uuid);
