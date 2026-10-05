import { api } from '$lib/api/api';

export type ProductCategory = 'DRUG' | 'CONSUMABLE' | 'SUPPLEMENT' | 'MEDICAL_DEVICE' | 'OTHER';

/**
 * Indonesian labels for the backend category enum.
 * Keeping these in one place stops the UI from hardcoding raw enum strings.
 */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
	DRUG: 'Obat',
	CONSUMABLE: 'BMHP',
	SUPPLEMENT: 'Suplemen',
	MEDICAL_DEVICE: 'Alkes',
	OTHER: 'Lainnya'
};

/** Ready-to-render options for <select> / filter dropdowns. */
export const PRODUCT_CATEGORY_OPTIONS = (
	Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]
).map((value) => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }));

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
	status: string;
	is_low_stock: boolean;
	is_out_of_stock: boolean;
	is_near_expiry: boolean;
	/**
	 * Expiry date of the nearest batch. Replaces the legacy `nearest_exp_date`
	 * from the previous schema.
	 */
	exp_date?: string | null;
	/**
	 * `supplierName` is no longer part of the product schema; supplier info
	 * now lives on InventoryLogs.source_destination (per mutation).
	 */
	supplierName?: string | null;
	createdAt?: string;
	updatedAt?: string;
};

/** Aggregate counts returned alongside the product catalog listing. */
export type ProductSummary = {
	total_products: number;
	total_low_stock: number;
	total_out_of_stock: number;
};

/** Pagination metadata shape returned by the backend. */
export type MetaPagination = {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
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

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** Full catalog fetched once from the backend. */
let allProducts = $state<Product[]>([]);
/** Current page of the catalog after client-side filtering. */
let products = $state<Product[]>([]);
let pendingPrescriptions = $state<PendingPrescription[]>([]);
let isLoadingProducts = $state<boolean>(false);
let isLoadingPrescriptions = $state<boolean>(false);
let isSubmitting = $state<boolean>(false);
let error = $state<string | null>(null);
let productsMeta = $state<MetaPagination | null>(null);
let productsSummary = $state<ProductSummary | null>(null);

/**
 * Filter state for the master produk list. All filtering happens in memory,
 * so changing the category / search / page never triggers a new request.
 */
let productFilter = $state<{
	search: string;
	category: string;
	low_stock: boolean;
	page: number;
	limit: number;
}>({
	search: '',
	category: 'ALL',
	low_stock: false,
	page: 1,
	limit: 10
});

/**
 * Recompute the visible page from the already-fetched catalog.
 * Pure in-memory work — no server round-trip.
 */
function applyProductFilter() {
	const search = productFilter.search.trim().toLowerCase();
	const { category, low_stock, page, limit } = productFilter;

	let filtered = allProducts;
	if (category && category !== 'ALL') {
		filtered = filtered.filter((p) => p.category === category);
	}
	if (low_stock) {
		filtered = filtered.filter((p) => p.is_low_stock);
	}
	if (search) {
		filtered = filtered.filter(
			(p) => p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search)
		);
	}

	const total = filtered.length;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const safePage = Math.min(Math.max(1, page), totalPages);
	const start = (safePage - 1) * limit;

	products = filtered.slice(start, start + limit);
	productsMeta = { total, page: safePage, limit, totalPages };
}

/**
 * Fetch the whole product catalog **once** — without building a query string.
 * Category / search / pagination are resolved client-side by `filterProducts`,
 * so the server is not hit again when the user just switches filters.
 *
 * The optional `params` argument is kept for backwards compatibility with
 * existing callers; it only seeds the in-memory filter and is NOT sent
 * to the backend.
 */
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
		const response = await api.get<{
			statusCode?: number;
			message?: string;
			data: Product[];
			summary?: ProductSummary;
			meta?: MetaPagination;
		}>('/products');

		if (response && Array.isArray(response.data)) {
			allProducts = response.data;
			productsSummary = response.summary ?? null;
		} else {
			allProducts = [];
			productsSummary = null;
		}

		// Seed the client-side filter from the caller's params (if any).
		if (params) {
			productFilter = {
				search: params.search ?? productFilter.search,
				category: params.category ?? productFilter.category,
				low_stock: params.low_stock ?? productFilter.low_stock,
				page: params.page ?? productFilter.page,
				limit: params.limit ?? productFilter.limit
			};
		}

		applyProductFilter();
		return products;
	} catch (err: any) {
		console.warn('GET /products failed:', err);
		error = parseBackendError(err);
		allProducts = [];
		products = [];
		productsMeta = null;
		productsSummary = null;
		return [];
	} finally {
		isLoadingProducts = false;
	}
}

/**
 * Filter the catalog that was already fetched (category, search, page).
 * Runs entirely in memory — the server is not contacted.
 */
export function filterProducts(params?: {
	search?: string;
	category?: string;
	low_stock?: boolean;
	page?: number;
	limit?: number;
}) {
	if (params) {
		productFilter = {
			search: params.search ?? productFilter.search,
			category: params.category ?? productFilter.category,
			low_stock: params.low_stock ?? productFilter.low_stock,
			page: params.page ?? productFilter.page,
			limit: params.limit ?? productFilter.limit
		};
	}
	applyProductFilter();
	return products;
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

export async function updateProduct(
	id: string,
	dto: {
		code?: string;
		name?: string;
		category?: ProductCategory;
		unit?: string;
		stock?: number;
		min_stock?: number;
		buy_price?: number;
		sell_price?: number;
		description?: string;
	}
) {
	isSubmitting = true;
	error = null;

	try {
		const response = await api.patch<{ statusCode: number; message: string; data: Product }>(
			`/products/${id}`,
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
	/** Full catalog (all products, unfiltered). */
	get catalog() {
		return allProducts;
	},
	/** Current filtered + paginated page. */
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
	get productsSummary() {
		return productsSummary;
	},
	fetchProducts,
	filterProducts,
	createProduct,
	updateProduct,
	restockProduct,
	fetchPendingPrescriptions,
	dispensePrescription
};
