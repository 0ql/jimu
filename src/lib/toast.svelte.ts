type ToastType = "success" | "error" | "warning";

/** A button in the toast, e.g. Undo; pressing it runs `run` and closes the toast. */
interface ToastAction {
	label: string;
	run: () => void;
}

interface Toast {
	id: number;
	type: ToastType;
	message: string;
	action?: ToastAction;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

const remove = (id: number) => {
	const idx = toasts.findIndex((t) => t.id === id);
	if (idx !== -1) toasts.splice(idx, 1);
};

const add = (type: ToastType, message: string, duration = 3500, action?: ToastAction) => {
	const id = nextId++;
	toasts.push({ id, type, message, action });
	setTimeout(() => remove(id), duration);
};

export const toast = {
	get list() {
		return toasts;
	},
	success: (message: string, duration?: number, action?: ToastAction) =>
		add("success", message, duration, action),
	error: (message: string, duration?: number) => add("error", message, duration),
	warning: (message: string, duration?: number) => add("warning", message, duration),
	remove,
};
