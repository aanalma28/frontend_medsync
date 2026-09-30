/**
 * Toast store sederhana — tidak bergantung pada library eksternal.
 * Dipakai oleh <Toaster /> dan seluruh halaman Dashboard Logistik.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
	id: number;
	variant: ToastVariant;
	title: string;
	description?: string;
};

const DEFAULT_DURATION = 4000;

let toasts = $state<ToastItem[]>([]);
let counter = 0;

function push(variant: ToastVariant, title: string, description?: string): number {
	const id = ++counter;
	toasts = [...toasts, { id, variant, title, description }];
	setTimeout(() => dismiss(id), DEFAULT_DURATION);
	return id;
}

export function dismiss(id: number): void {
	toasts = toasts.filter((t) => t.id !== id);
}

export const toast = {
	get items(): ToastItem[] {
		return toasts;
	},
	success(title: string, description?: string) {
		return push('success', title, description);
	},
	error(title: string, description?: string) {
		return push('error', title, description);
	},
	info(title: string, description?: string) {
		return push('info', title, description);
	},
	warning(title: string, description?: string) {
		return push('warning', title, description);
	},
	dismiss
};
