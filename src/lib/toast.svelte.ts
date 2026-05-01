type ToastType = "success" | "error" | "warning";

interface Toast {
	id: number;
	type: ToastType;
	message: string;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

const remove = (id: number) => {
	const idx = toasts.findIndex((t) => t.id === id);
	if (idx !== -1) toasts.splice(idx, 1);
};

const add = (type: ToastType, message: string, duration = 3500) => {
	const id = nextId++;
	toasts.push({ id, type, message });
	setTimeout(() => remove(id), duration);
};

export const toast = {
	get list() {
		return toasts;
	},
	success: (message: string, duration?: number) => add("success", message, duration),
	error: (message: string, duration?: number) => add("error", message, duration),
	warning: (message: string, duration?: number) => add("warning", message, duration),
	remove,
};
