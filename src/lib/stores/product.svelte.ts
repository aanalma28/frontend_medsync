import { api } from '$lib/api/api';

export type ProductCategory = 'DRUG' | 'CONSUMABLE' | 'SUPPLEMENT' | 'MEDICAL_DEVICE' | 'OTHER';

export type Product = {
	id: string;
	code: string;
	name: string;
	category: ProductCategory;
	unit: string;
	stock: number;
	min_stock: number;
	buy_price: number;
	sell_price: number;
	description?: string;
	is_low_stock: boolean;
	nearest_exp_date?: string | null;
	is_near_expiry: boolean;
	inventoryLogsCount?: number;
	createdAt?: string;
	updatedAt?: string;
};

export type PrescriptionItem = {
	id: string;
	product_id: string;
	product_name: string;
	product_code: string;
	product_stock: number;
	rules_using: string;
};

export type PendingPrescription = {
	id: string;
	no_trx: string;
	recipe_date: string;
	status: string;
	patient_name: string;
	medical_record_number: string;
	patient_phone: string;
	doctor_name: string;
	items: PrescriptionItem[];
};

export function parseBackendError(err: any): string {
	if (!err) return 'Terjadi kesalahan yang tidak diketahui';
	const rawMessage = err?.response?.message || err?.message || err;
	let formatted = '';

	if (Array.isArray(rawMessage)) {
		formatted = rawMessage.join('\n• ');
		if (rawMessage.length > 1) {
			formatted = '• ' + formatted;
		}
	} else if (typeof rawMessage === 'object' && rawMessage !== null) {
		formatted = rawMessage.message ? String(rawMessage.message) : JSON.stringify(rawMessage);
	} else {
		formatted = String(rawMessage);
	}

	return formatted || 'Terjadi kesalahan pada server';
}

let products = $state<Product[]>([]);
let pendingPrescriptions = $state<PendingPrescription[]>([]);
let isLoadingProducts = $state<boolean>(false);
let isLoadingPrescriptions = $state<boolean>(false);
let isSubmitting = $state<boolean>(false);
let error = $state<string | null>(null);
let productsMeta = $state<any>(null);

export async function fetchProducts(params?: {
	search?: string;
	category?: string;
	low_stock?: boolean;
	page?: number;
	limit?: number;
}) {
	isLoadingProducts = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.category) query.set('category', params.category);
		if (params?.low_stock) query.set('low_stock', 'true');
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit || 50));

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<{ data: Product[]; meta?: any }>(`/products${queryString}`);

		if (response && Array.isArray(response.data)) {
			products = response.data;
			productsMeta = response.meta || null;
		} else {
			products = [];
		}
		return products;
	} catch (err: any) {
		console.warn('GET /products failed:', err);
		error = parseBackendError(err);
		return [];
	} finally {
		isLoadingProducts = false;
	}
}

export async function createProduct(dto: {
	code: string;
	name: string;
	category: ProductCategory;
	unit: string;
	stock: number;
	min_stock: number;
	buy_price: number;
	sell_price: number;
	description?: string;
}) {
	isSubmitting = true;
	error = null;

	try {
		const response = await api.post<{ statusCode: number; message: string; data: Product }>(
			'/products',
			dto
		);
		await fetchProducts();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		isSubmitting = false;
	}
}

export async function restockProduct(
	id: string,
	dto: {
		quantity: number;
		buy_price: number;
		exp_date?: string;
		supplierName?: string;
		reference_number?: string;
		notes?: string;
	}
) {
	isSubmitting = true;
	error = null;

	try {
		const response = await api.patch<{ statusCode: number; message: string; data: Product }>(
			`/products/${id}/restock`,
			dto
		);
		await fetchProducts();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		isSubmitting = false;
	}
}

export async function fetchPendingPrescriptions() {
	isLoadingPrescriptions = true;
	error = null;

	try {
		const response = await api.get<{ data: PendingPrescription[] }>('/prescriptions/pending');
		if (response && Array.isArray(response.data)) {
			pendingPrescriptions = response.data;
		} else {
			pendingPrescriptions = [];
		}
		return pendingPrescriptions;
	} catch (err: any) {
		console.warn('GET /prescriptions/pending failed:', err);
		error = parseBackendError(err);
		return [];
	} finally {
		isLoadingPrescriptions = false;
	}
}

export async function dispensePrescription(id: string, verifyNotes?: string) {
	isSubmitting = true;
	error = null;

	try {
		const response = await api.post<{ statusCode: number; message: string; data: any }>(
			`/prescriptions/${id}/dispense`,
			{ verify_notes: verifyNotes }
		);
		await Promise.all([fetchPendingPrescriptions(), fetchProducts()]);
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		isSubmitting = false;
	}
}

export const productStore = {
	get products() {
		return products;
	},
	get pendingPrescriptions() {
		return pendingPrescriptions;
	},
	get isLoadingProducts() {
		return isLoadingProducts;
	},
	get isLoadingPrescriptions() {
		return isLoadingPrescriptions;
	},
	get isSubmitting() {
		return isSubmitting;
	},
	get error() {
		return error;
	},
	get productsMeta() {
		return productsMeta;
	},
	fetchProducts,
	createProduct,
	restockProduct,
	fetchPendingPrescriptions,
	dispensePrescription
};
