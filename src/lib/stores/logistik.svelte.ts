/* =========================================================================
 * Dashboard Logistik — store terpusat (DUMMY DATA)
 * -------------------------------------------------------------------------
 * Meniru skema backend multi-gudang:
 *   Products        -> master katalog universal
 *   Warehouses      -> lokasi penyimpanan fisik
 *   WarehouseStocks -> sisa stok aktual per produk per warehouse
 *   InventoryLogs   -> ledger audit trail mutasi stok
 *   StockRequests   -> permintaan/amprahan dari unit operasional
 *   StockBatches    -> batch stok penerimaan (penerimaan/purchasing)
 *
 * Semua fetcher meniru perilaku server (delay, query param, paginasi,
 * meta) sehingga penggantian ke endpoint asli cukup menukar isi fungsi.
 * ========================================================================= */

import type { MetaPagination } from '$lib/stores/user.svelte';
import { api } from '$lib/api/api';

export type { MetaPagination };

/* ------------------------------------------------------------------ */
/* Kategori produk                                                     */
/* ------------------------------------------------------------------ */

export type ProductCategory =
	| 'DRUG'
	| 'CONSUMABLE'
	| 'MEDICAL_DEVICE'
	| 'SUPPLEMENT'
	| 'REAGENT'
	| 'OTHER';

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
	DRUG: 'Obat',
	CONSUMABLE: 'BMHP',
	MEDICAL_DEVICE: 'Alkes',
	SUPPLEMENT: 'Suplemen',
	REAGENT: 'Reagen',
	OTHER: 'Lainnya'
};

export const PRODUCT_CATEGORY_OPTIONS = (
	Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]
).map((value) => ({ value, label: PRODUCT_CATEGORY_LABELS[value] }));

/* ------------------------------------------------------------------ */
/* Warehouse                                                           */
/* ------------------------------------------------------------------ */

export type WarehouseType = 'MAIN' | 'PHARMACY' | 'CLINIC' | 'LAB' | 'WARD';

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
	MAIN: 'Gudang Utama',
	PHARMACY: 'Depo Farmasi',
	CLINIC: 'Depo Poli/IGD',
	LAB: 'Depo Laboratorium',
	WARD: 'Depo Rawat Inap'
};

/**
 * Bentuk objek warehouse disamakan dengan response backend (GET /warehouses).
 * `is_main` menandai gudang utama (bertipe MAIN) yang dipakai untuk keperluan
 * penerimaan barang / purchasing.
 */
export type Warehouse = {
	id: string;
	name: string;
	type: WarehouseType;
	description?: string;
	is_main: boolean;
	distinct_product_count: number;
	total_stock_quantity: number;
	createdAt?: string;
	updatedAt?: string;
};

/* ------------------------------------------------------------------ */
/* Produk & stok                                                       */
/* ------------------------------------------------------------------ */

export type Product = {
	id: string;
	code: string;
	name: string;
	category: ProductCategory;
	unit: string;
	description?: string;
	min_stock: number;
	buy_price: number;
	sell_price: number;
	createdAt?: string;
	updatedAt?: string;
};

export type WarehouseStock = {
	id: string;
	warehouse_id: string;
	product_id: string;
	stock: number;
	updatedAt?: string;
};

export type LowStockRow = {
	product: Product;
	warehouse: Warehouse;
	stock: number;
	min_stock: number;
	deficit: number;
};

export type StockMatrixCell = { warehouse: Warehouse; stock: number; is_low: boolean };
export type StockMatrixRow = { product: Product; cells: StockMatrixCell[]; total: number };

/* ------------------------------------------------------------------ */
/* Inventory Logs                                                      */
/* ------------------------------------------------------------------ */

export type InventoryLogType =
	| 'PURCHASE'
	| 'TRANSFER_OUT'
	| 'TRANSFER_IN'
	| 'DISPENSE'
	| 'USAGE'
	| 'ADJUSTMENT';

export const INVENTORY_LOG_TYPE_LABELS: Record<InventoryLogType, string> = {
	PURCHASE: 'Penerimaan',
	TRANSFER_OUT: 'Transfer Keluar',
	TRANSFER_IN: 'Transfer Masuk',
	DISPENSE: 'Dispensing',
	USAGE: 'Pemakaian',
	ADJUSTMENT: 'Penyesuaian'
};

export const INVENTORY_LOG_TYPE_VARIANTS: Record<InventoryLogType, string> = {
	PURCHASE: 'green',
	TRANSFER_OUT: 'amber',
	TRANSFER_IN: 'blue',
	DISPENSE: 'purple',
	USAGE: 'slate',
	ADJUSTMENT: 'red'
};

export type InventoryLog = {
	id: string;
	product_id: string;
	warehouse_id: string;
	type: InventoryLogType;
	/** Bertanda: positif = masuk, negatif = keluar. */
	quantity: number;
	balance_after: number;
	reference?: string;
	batch_number?: string;
	exp_date?: string | null;
	notes?: string;
	actor?: string;
	createdAt: string;
};

/* ------------------------------------------------------------------ */
/* Stock Batches (penerimaan / purchasing)                             */
/* ------------------------------------------------------------------ */

export type StockBatchStatus = 'AVAILABLE' | 'NEAR_EXPIRY' | 'EXPIRED' | 'OUT_OF_STOCK';

export const STOCK_BATCH_STATUS_LABELS: Record<StockBatchStatus, string> = {
	AVAILABLE: 'Tersedia',
	NEAR_EXPIRY: 'Hampir ED',
	EXPIRED: 'Kedaluwarsa',
	OUT_OF_STOCK: 'Habis'
};

export const STOCK_BATCH_STATUS_VARIANTS: Record<StockBatchStatus, string> = {
	AVAILABLE: 'green',
	NEAR_EXPIRY: 'amber',
	EXPIRED: 'red',
	OUT_OF_STOCK: 'slate'
};

export type StockBatchProduct = {
	id: string;
	code: string;
	name: string;
	unit: string;
	category: ProductCategory;
};

export type StockBatchWarehouse = {
	id: string;
	name: string;
	type: WarehouseType;
};

export type StockBatch = {
	id: string;
	batch_number: string;
	exp_date: string | null;
	buy_price: number;
	initial_stock: number;
	current_stock: number;
	/** Sisa stok dalam persen — 100 berarti batch belum tersentuh. */
	remaining_percentage: number;
	status: StockBatchStatus;
	is_empty: boolean;
	is_expired: boolean;
	is_near_expiry: boolean;
	product: StockBatchProduct | null;
	warehouse: StockBatchWarehouse | null;
	createdAt?: string;
	updatedAt?: string;
};

export type StockBatchSummary = {
	total_batches: number;
	total_initial_stock: number;
	total_current_stock: number;
	total_expired_batches: number;
	total_near_expiry_batches: number;
	total_empty_batches: number;
};

/* ------------------------------------------------------------------ */
/* Stock Requests (amprahan)                                           */
/* ------------------------------------------------------------------ */

export type StockRequestStatus = 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'FULFILLED';

export const STOCK_REQUEST_STATUS_LABELS: Record<StockRequestStatus, string> = {
	PENDING: 'Menunggu',
	APPROVED: 'Disetujui',
	PARTIAL: 'Disetujui Sebagian',
	REJECTED: 'Ditolak',
	FULFILLED: 'Terkirim'
};

export const STOCK_REQUEST_STATUS_VARIANTS: Record<StockRequestStatus, string> = {
	PENDING: 'amber',
	APPROVED: 'blue',
	PARTIAL: 'purple',
	REJECTED: 'red',
	FULFILLED: 'green'
};

export type StockRequestItem = {
	id: string;
	product_id: string;
	requested_qty: number;
	approved_qty: number | null;
};

export type StockRequest = {
	id: string;
	no_trx: string;
	/** Gudang asal pengeluaran (biasanya Gudang Utama). */
	from_warehouse_id: string;
	/** Gudang tujuan (unit pemohon). */
	to_warehouse_id: string;
	requester: string;
	unit_name: string;
	status: StockRequestStatus;
	requested_at: string;
	notes?: string;
	handled_by?: string;
	items: StockRequestItem[];
};

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

let idCounter = 5000;
function uid(prefix: string): string {
	return `${prefix}-${++idCounter}`;
}

function now(): string {
	return new Date().toISOString();
}

function delay(ms = 420): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function paginate<T>(rows: T[], page = 1, limit = 10): { data: T[]; meta: MetaPagination } {
	const total = rows.length;
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const safePage = Math.min(Math.max(1, page), totalPages);
	const start = (safePage - 1) * limit;
	return {
		data: rows.slice(start, start + limit),
		meta: { total, page: safePage, limit, totalPages }
	};
}

function parseError(err: any): string {
	if (!err) return 'Terjadi kesalahan yang tidak diketahui';
	const raw = err?.response?.message || err?.message || err;
	if (Array.isArray(raw)) return raw.join(' • ');
	if (typeof raw === 'object' && raw !== null) {
		return raw.message ? String(raw.message) : JSON.stringify(raw);
	}
	return String(raw);
}

/* ------------------------------------------------------------------ */
/* Seed data (dummy)                                                   */
/* ------------------------------------------------------------------ */

function seedProducts(): Product[] {
	const ts = now();
	return [
		{ id: 'prd-01', code: 'OBT-0001', name: 'Paracetamol 500 mg Tablet', category: 'DRUG', unit: 'Strip', description: 'Analgesik & antipiretik', min_stock: 50, buy_price: 4500, sell_price: 7000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-02', code: 'OBT-0002', name: 'Amoxicillin 500 mg Kapsul', category: 'DRUG', unit: 'Strip', description: 'Antibiotik spektrum luas', min_stock: 40, buy_price: 12500, sell_price: 18000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-03', code: 'OBT-0003', name: 'Ibuprofen 400 mg Tablet', category: 'DRUG', unit: 'Strip', description: 'Anti inflamasi non steroid', min_stock: 40, buy_price: 6000, sell_price: 9000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-04', code: 'OBT-0004', name: 'Omeprazole 20 mg Kapsul', category: 'DRUG', unit: 'Box', description: 'Penghambat pompa proton', min_stock: 20, buy_price: 22000, sell_price: 31000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-05', code: 'BMHP-0001', name: 'Handscoon Steril No.7', category: 'CONSUMABLE', unit: 'Pasang', description: 'Sarung tangan bedah steril', min_stock: 200, buy_price: 3500, sell_price: 5000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-06', code: 'BMHP-0002', name: 'Masker Medis 3 Ply', category: 'CONSUMABLE', unit: 'Box', description: 'Isi 50 pcs per box', min_stock: 100, buy_price: 28000, sell_price: 40000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-07', code: 'BMHP-0003', name: 'Infus Set Dewasa', category: 'CONSUMABLE', unit: 'Pcs', description: 'Infus set makro drip', min_stock: 150, buy_price: 9500, sell_price: 14000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-08', code: 'BMHP-0004', name: 'NaCl 0.9% 500 ml', category: 'CONSUMABLE', unit: 'Botol', description: 'Cairan infus isotonik', min_stock: 80, buy_price: 11000, sell_price: 16000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-09', code: 'ALK-0001', name: 'Tensimeter Digital', category: 'MEDICAL_DEVICE', unit: 'Unit', description: 'Alat ukur tekanan darah', min_stock: 5, buy_price: 385000, sell_price: 520000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-10', code: 'ALK-0002', name: 'Termometer Infrared', category: 'MEDICAL_DEVICE', unit: 'Unit', description: 'Termometer non-kontak', min_stock: 5, buy_price: 175000, sell_price: 240000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-11', code: 'REA-0001', name: 'Reagen Glukosa Strip', category: 'REAGENT', unit: 'Box', description: 'Strip tes glukosa darah', min_stock: 15, buy_price: 145000, sell_price: 195000, createdAt: ts, updatedAt: ts },
		{ id: 'prd-12', code: 'REA-0002', name: 'Reagen Hemoglobin', category: 'REAGENT', unit: 'Kit', description: 'Kit pemeriksaan Hb', min_stock: 10, buy_price: 210000, sell_price: 280000, createdAt: ts, updatedAt: ts }
	];
}

function seedWarehouses(): Warehouse[] {
	const ts = now();
	return [
		{ id: 'wh-01', name: 'Gudang Utama', type: 'MAIN', description: 'Gedung A Lantai 1', is_main: true, distinct_product_count: 12, total_stock_quantity: 0, createdAt: ts, updatedAt: ts },
		{ id: 'wh-02', name: 'Depo Farmasi', type: 'PHARMACY', description: 'Gedung A Lantai 2', is_main: false, distinct_product_count: 11, total_stock_quantity: 0, createdAt: ts, updatedAt: ts },
		{ id: 'wh-03', name: 'Depo Poli/IGD', type: 'CLINIC', description: 'Gedung B Lantai 1', is_main: false, distinct_product_count: 9, total_stock_quantity: 0, createdAt: ts, updatedAt: ts },
		{ id: 'wh-04', name: 'Depo Laboratorium', type: 'LAB', description: 'Gedung C Lantai 1', is_main: false, distinct_product_count: 4, total_stock_quantity: 0, createdAt: ts, updatedAt: ts }
	];
}

function seedStocks(): WarehouseStock[] {
	// [product_id, Gudang Utama, Depo Farmasi, Depo Poli/IGD, Depo Lab]
	const grid: Array<[string, number, number, number, number]> = [
		['prd-01', 1450, 320, 140, 0],
		['prd-02', 620, 150, 60, 0],
		['prd-03', 480, 120, 45, 0],
		['prd-04', 210, 48, 12, 0],
		['prd-05', 1800, 420, 260, 40],
		['prd-06', 640, 120, 75, 20],
		['prd-07', 430, 90, 150, 10],
		['prd-08', 520, 180, 60, 15],
		['prd-09', 14, 3, 2, 0],
		['prd-10', 12, 2, 1, 0],
		['prd-11', 60, 12, 0, 26],
		['prd-12', 8, 2, 0, 9]
	];
	const warehouseIds = ['wh-01', 'wh-02', 'wh-03', 'wh-04'];
	const rows: WarehouseStock[] = [];
	let n = 0;
	for (const [productId, ...values] of grid) {
		values.forEach((stock, index) => {
			rows.push({
				id: `wst-${String(++n).padStart(3, '0')}`,
				warehouse_id: warehouseIds[index],
				product_id: productId,
				stock,
				updatedAt: now()
			});
		});
	}
	return rows;
}

function seedLogs(): InventoryLog[] {
	const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
	return [
		{ id: 'log-0001', product_id: 'prd-01', warehouse_id: 'wh-01', type: 'PURCHASE', quantity: 500, balance_after: 1450, reference: 'PO-2024-0091', batch_number: 'B2401-01', exp_date: '2026-03-31', notes: 'Supplier: PT Kimia Farma Trading', actor: 'Rizky (Logistik)', createdAt: hoursAgo(2) },
		{ id: 'log-0002', product_id: 'prd-05', warehouse_id: 'wh-01', type: 'PURCHASE', quantity: 1000, balance_after: 1800, reference: 'PO-2024-0092', batch_number: 'HS-2402-A', exp_date: '2027-01-31', notes: 'Supplier: PT Medika Jaya', actor: 'Rizky (Logistik)', createdAt: hoursAgo(6) },
		{ id: 'log-0003', product_id: 'prd-01', warehouse_id: 'wh-01', type: 'TRANSFER_OUT', quantity: -200, balance_after: 950, reference: 'RO-2024-0440', notes: 'Ke Depo Farmasi', actor: 'Rizky (Logistik)', createdAt: hoursAgo(9) },
		{ id: 'log-0004', product_id: 'prd-01', warehouse_id: 'wh-02', type: 'TRANSFER_IN', quantity: 200, balance_after: 320, reference: 'RO-2024-0440', notes: 'Dari Gudang Utama', actor: 'Apt. Dinda', createdAt: hoursAgo(9) },
		{ id: 'log-0005', product_id: 'prd-04', warehouse_id: 'wh-02', type: 'DISPENSE', quantity: -12, balance_after: 48, reference: 'RES-2024-1187', notes: 'Resep pasien rawat jalan', actor: 'Apt. Dinda', createdAt: hoursAgo(11) },
		{ id: 'log-0006', product_id: 'prd-07', warehouse_id: 'wh-03', type: 'USAGE', quantity: -20, balance_after: 150, reference: 'IGD-2024-0233', notes: 'Pemakaian tindakan IGD', actor: 'Ns. Bayu', createdAt: hoursAgo(14) },
		{ id: 'log-0007', product_id: 'prd-11', warehouse_id: 'wh-04', type: 'USAGE', quantity: -6, balance_after: 26, reference: 'LAB-2024-0512', notes: 'Pemeriksaan glukosa rutin', actor: 'Analis Sari', createdAt: hoursAgo(20) },
		{ id: 'log-0008', product_id: 'prd-09', warehouse_id: 'wh-02', type: 'ADJUSTMENT', quantity: -1, balance_after: 3, reference: 'OPN-2024-0021', notes: 'Selisih hasil stock opname — alat rusak', actor: 'Rizky (Logistik)', createdAt: hoursAgo(28) },
		{ id: 'log-0009', product_id: 'prd-02', warehouse_id: 'wh-01', type: 'PURCHASE', quantity: 300, balance_after: 620, reference: 'PO-2024-0088', batch_number: 'AMX-2401-C', exp_date: '2025-12-31', notes: 'Supplier: PT Anugrah Farma', actor: 'Rizky (Logistik)', createdAt: hoursAgo(34) },
		{ id: 'log-0010', product_id: 'prd-06', warehouse_id: 'wh-01', type: 'TRANSFER_OUT', quantity: -160, balance_after: 640, reference: 'RO-2024-0447', notes: 'Ke Depo Poli/IGD', actor: 'Rizky (Logistik)', createdAt: hoursAgo(40) }
	];
}

function seedRequests(): StockRequest[] {
	const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
	return [
		{
			id: 'req-01', no_trx: 'RO-2024-0451', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-02',
			requester: 'Apt. Dinda', unit_name: 'Depo Farmasi', status: 'PENDING', requested_at: hoursAgo(3),
			notes: 'Stok rutin mingguan untuk resep rawat jalan.',
			items: [
				{ id: 'rqi-01', product_id: 'prd-01', requested_qty: 200, approved_qty: null },
				{ id: 'rqi-02', product_id: 'prd-02', requested_qty: 100, approved_qty: null },
				{ id: 'rqi-03', product_id: 'prd-04', requested_qty: 40, approved_qty: null }
			]
		},
		{
			id: 'req-02', no_trx: 'RO-2024-0452', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-03',
			requester: 'Ns. Bayu', unit_name: 'Depo Poli/IGD', status: 'PENDING', requested_at: hoursAgo(5),
			notes: 'Antisipasi shift malam IGD.',
			items: [
				{ id: 'rqi-04', product_id: 'prd-07', requested_qty: 80, approved_qty: null },
				{ id: 'rqi-05', product_id: 'prd-08', requested_qty: 40, approved_qty: null },
				{ id: 'rqi-06', product_id: 'prd-05', requested_qty: 120, approved_qty: null }
			]
		},
		{
			id: 'req-03', no_trx: 'RO-2024-0449', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-04',
			requester: 'Analis Sari', unit_name: 'Depo Laboratorium', status: 'APPROVED', requested_at: hoursAgo(22),
			handled_by: 'Rizky (Logistik)', notes: 'Disetujui penuh, menunggu pengiriman.',
			items: [
				{ id: 'rqi-07', product_id: 'prd-11', requested_qty: 20, approved_qty: 20 },
				{ id: 'rqi-08', product_id: 'prd-12', requested_qty: 8, approved_qty: 8 }
			]
		},
		{
			id: 'req-04', no_trx: 'RO-2024-0448', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-03',
			requester: 'Ns. Bayu', unit_name: 'Depo Poli/IGD', status: 'PARTIAL', requested_at: hoursAgo(30),
			handled_by: 'Rizky (Logistik)', notes: 'Stok Gudang Utama tidak mencukupi untuk sebagian item.',
			items: [
				{ id: 'rqi-09', product_id: 'prd-09', requested_qty: 4, approved_qty: 4 },
				{ id: 'rqi-10', product_id: 'prd-10', requested_qty: 4, approved_qty: 2 }
			]
		},
		{
			id: 'req-05', no_trx: 'RO-2024-0445', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-02',
			requester: 'Apt. Dinda', unit_name: 'Depo Farmasi', status: 'REJECTED', requested_at: hoursAgo(56),
			handled_by: 'Rizky (Logistik)', notes: 'Ditolak — pengajuan duplikat.',
			items: [{ id: 'rqi-11', product_id: 'prd-03', requested_qty: 150, approved_qty: 0 }]
		},
		{
			id: 'req-06', no_trx: 'RO-2024-0440', from_warehouse_id: 'wh-01', to_warehouse_id: 'wh-02',
			requester: 'Apt. Dinda', unit_name: 'Depo Farmasi', status: 'FULFILLED', requested_at: hoursAgo(72),
			handled_by: 'Rizky (Logistik)', notes: 'Barang sudah diterima unit tujuan.',
			items: [{ id: 'rqi-12', product_id: 'prd-01', requested_qty: 200, approved_qty: 200 }]
		}
	];
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let masterProducts = $state<Product[]>(seedProducts());
let warehouses = $state<Warehouse[]>(seedWarehouses());
let warehouseStocks = $state<WarehouseStock[]>(seedStocks());
let inventoryLogs = $state<InventoryLog[]>(seedLogs());
let stockRequests = $state<StockRequest[]>(seedRequests());

// View (halaman berpaginasi)
let productRows = $state<Product[]>([]);
let productMeta = $state<MetaPagination | null>(null);

let stockMatrix = $state<StockMatrixRow[]>([]);

let logRows = $state<InventoryLog[]>([]);
let logMeta = $state<MetaPagination | null>(null);

// Batch stok penerimaan (GET /logistics/stock-batches)
let purchaseRows = $state<StockBatch[]>([]);
let purchaseMeta = $state<MetaPagination | null>(null);
let purchaseSummary = $state<StockBatchSummary | null>(null);

let requestRows = $state<StockRequest[]>([]);
let requestMeta = $state<MetaPagination | null>(null);

let isLoadingProducts = $state(false);
let isLoadingStock = $state(false);
let isLoadingLogs = $state(false);
let isLoadingPurchases = $state(false);
let isLoadingRequests = $state(false);
let isLoadingWarehouses = $state(false);
let isSubmitting = $state(false);
let error = $state<string | null>(null);

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function getProduct(id: string): Product | undefined {
	return masterProducts.find((p) => p.id === id);
}

function getWarehouse(id: string): Warehouse | undefined {
	return warehouses.find((w) => w.id === id);
}

function getStock(warehouseId: string, productId: string): number {
	return (
		warehouseStocks.find((s) => s.warehouse_id === warehouseId && s.product_id === productId)?.stock ?? 0
	);
}

/** Cari row stok, buat bila belum ada, lalu kembalikan proxy-nya agar reactive. */
function ensureStockRow(warehouseId: string, productId: string): WarehouseStock {
	let row = warehouseStocks.find(
		(s) => s.warehouse_id === warehouseId && s.product_id === productId
	);
	if (!row) {
		warehouseStocks.push({
			id: uid('wst'),
			warehouse_id: warehouseId,
			product_id: productId,
			stock: 0,
			updatedAt: now()
		});
		row = warehouseStocks.find(
			(s) => s.warehouse_id === warehouseId && s.product_id === productId
		);
	}
	return row as WarehouseStock;
}

/* ------------------------------------------------------------------ */
/* Fetch: Warehouses                                                   */
/* ------------------------------------------------------------------ */

type WarehouseListResponse = {
	statusCode: number;
	message: string;
	data: Warehouse[];
	meta: MetaPagination;
};

/**
 * Ambil daftar warehouse dari backend (GET /warehouses).
 * Backend mengembalikan objek dengan field: id, name, type, description,
 * is_main, distinct_product_count, total_stock_quantity, createdAt, updatedAt.
 */
export async function fetchWarehouses(params?: {
	search?: string;
	page?: number;
	limit?: number;
}): Promise<Warehouse[]> {
	isLoadingWarehouses = true;
	error = null;
	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));
		const qs = query.toString();

		const result = await api.get<WarehouseListResponse>(`/warehouses${qs ? `?${qs}` : ''}`);

		const data = (result.data ?? []).map((w) => ({
			id: w.id,
			name: w.name,
			type: w.type,
			description: w.description,
			is_main: w.is_main ?? w.type === 'MAIN',
			distinct_product_count: w.distinct_product_count ?? 0,
			total_stock_quantity: w.total_stock_quantity ?? 0,
			createdAt: w.createdAt,
			updatedAt: w.updatedAt
		}));

		warehouses = data;
		return warehouses;
	} catch (err) {
		error = parseError(err);
		return warehouses;
	} finally {
		isLoadingWarehouses = false;
	}
}

/* ------------------------------------------------------------------ */
/* Fetch: Products                                                     */
/* ------------------------------------------------------------------ */

export async function fetchProducts(params?: {
	search?: string;
	category?: string;
	page?: number;
	limit?: number;
}): Promise<Product[]> {
	isLoadingProducts = true;
	error = null;
	try {
		await delay();
		const q = (params?.search ?? '').trim().toLowerCase();
		let rows = [...masterProducts];

		if (q) {
			rows = rows.filter(
				(p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
			);
		}
		if (params?.category && params.category !== 'ALL') {
			rows = rows.filter((p) => p.category === params.category);
		}
		rows.sort((a, b) => a.name.localeCompare(b.name));

		const { data, meta } = paginate(rows, params?.page ?? 1, params?.limit ?? 10);
		productRows = data;
		productMeta = meta;
		return data;
	} catch (err) {
		error = parseError(err);
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
	min_stock: number;
	buy_price: number;
	sell_price: number;
	description?: string;
}): Promise<Product> {
	isSubmitting = true;
	error = null;
	try {
		await delay(350);
		if (masterProducts.some((p) => p.code.toLowerCase() === dto.code.trim().toLowerCase())) {
			throw new Error(`Kode produk "${dto.code}" sudah digunakan`);
		}
		const product: Product = {
			id: uid('prd'),
			code: dto.code.trim(),
			name: dto.name.trim(),
			category: dto.category,
			unit: dto.unit.trim(),
			description: dto.description?.trim() || undefined,
			min_stock: Number(dto.min_stock) || 0,
			buy_price: Number(dto.buy_price) || 0,
			sell_price: Number(dto.sell_price) || 0,
			createdAt: now(),
			updatedAt: now()
		};
		masterProducts = [product, ...masterProducts];
		for (const w of warehouses) {
			warehouseStocks.push({
				id: uid('wst'),
				warehouse_id: w.id,
				product_id: product.id,
				stock: 0,
				updatedAt: now()
			});
		}
		return product;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

export async function updateProduct(
	id: string,
	dto: Partial<{
		code: string;
		name: string;
		category: ProductCategory;
		unit: string;
		min_stock: number;
		buy_price: number;
		sell_price: number;
		description: string;
	}>
): Promise<Product> {
	isSubmitting = true;
	error = null;
	try {
		await delay(350);
		const product = getProduct(id);
		if (!product) throw new Error('Produk tidak ditemukan');

		if (dto.code && dto.code.trim().toLowerCase() !== product.code.toLowerCase()) {
			if (masterProducts.some((p) => p.id !== id && p.code.toLowerCase() === dto.code!.trim().toLowerCase())) {
				throw new Error(`Kode produk "${dto.code}" sudah digunakan`);
			}
		}

		Object.assign(product, {
			...dto,
			code: dto.code?.trim() ?? product.code,
			name: dto.name?.trim() ?? product.name,
			min_stock: dto.min_stock !== undefined ? Number(dto.min_stock) : product.min_stock,
			buy_price: dto.buy_price !== undefined ? Number(dto.buy_price) : product.buy_price,
			sell_price: dto.sell_price !== undefined ? Number(dto.sell_price) : product.sell_price,
			updatedAt: now()
		});
		return product;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

export async function deleteProduct(id: string): Promise<boolean> {
	isSubmitting = true;
	error = null;
	try {
		// Kirim permintaan hapus ke backend: DELETE /products/{id}
		await api.delete(`/products/${id}`);

		// Sinkronkan state lokal hanya setelah backend mengonfirmasi.
		masterProducts = masterProducts.filter((p) => p.id !== id);
		warehouseStocks = warehouseStocks.filter((s) => s.product_id !== id);
		return true;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

/* ------------------------------------------------------------------ */
/* Fetch: Stock matrix & low stock                                     */
/* ------------------------------------------------------------------ */

export async function fetchStockMatrix(params?: {
	search?: string;
	category?: string;
	warehouse_id?: string;
}): Promise<StockMatrixRow[]> {
	isLoadingStock = true;
	error = null;
	try {
		await delay();
		const q = (params?.search ?? '').trim().toLowerCase();
		let rows = [...masterProducts];

		if (q) {
			rows = rows.filter(
				(p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
			);
		}
		if (params?.category && params.category !== 'ALL') {
			rows = rows.filter((p) => p.category === params.category);
		}
		rows.sort((a, b) => a.name.localeCompare(b.name));

		const cols =
			params?.warehouse_id && params.warehouse_id !== 'ALL'
				? warehouses.filter((w) => w.id === params.warehouse_id)
				: warehouses;

		stockMatrix = rows.map((product) => {
			const cells = cols.map((warehouse) => {
				const stock = getStock(warehouse.id, product.id);
				return { warehouse, stock, is_low: stock <= product.min_stock };
			});
			return { product, cells, total: cells.reduce((sum, c) => sum + c.stock, 0) };
		});
		return stockMatrix;
	} catch (err) {
		error = parseError(err);
		return [];
	} finally {
		isLoadingStock = false;
	}
}

/* ------------------------------------------------------------------ */
/* Restock / Purchase                                                  */
/* ------------------------------------------------------------------ */

export async function restockProduct(dto: {
	product_id: string;
	warehouse_id: string;
	quantity: number;
	buy_price: number;
	batch_number?: string;
	exp_date?: string;
	reference_number?: string;
	supplier_name?: string;
	notes?: string;
}): Promise<InventoryLog> {
	isSubmitting = true;
	error = null;
	try {
		await delay(520);
		const product = getProduct(dto.product_id);
		if (!product) throw new Error('Produk tidak ditemukan');
		if (Number(dto.quantity) <= 0) throw new Error('Kuantiti harus lebih dari 0');

		const row = ensureStockRow(dto.warehouse_id, dto.product_id);
		row.stock += Number(dto.quantity);
		row.updatedAt = now();

		product.buy_price = Number(dto.buy_price) || product.buy_price;
		product.updatedAt = now();

		const log: InventoryLog = {
			id: uid('log'),
			product_id: dto.product_id,
			warehouse_id: dto.warehouse_id,
			type: 'PURCHASE',
			quantity: Number(dto.quantity),
			balance_after: row.stock,
			reference: dto.reference_number?.trim() || undefined,
			batch_number: dto.batch_number?.trim() || undefined,
			exp_date: dto.exp_date || null,
			notes:
				dto.notes?.trim() ||
				(dto.supplier_name ? `Supplier: ${dto.supplier_name.trim()}` : undefined),
			actor: 'Petugas Logistik',
			createdAt: now()
		};
		inventoryLogs = [log, ...inventoryLogs];
		return log;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

/* ------------------------------------------------------------------ */
/* Fetch: Stock Batches (penerimaan)                                   */
/* ------------------------------------------------------------------ */

type StockBatchListResponse = {
	statusCode: number;
	message: string;
	data: StockBatch[];
	summary: StockBatchSummary;
	meta: MetaPagination;
};

/**
 * Ambil daftar batch stok dari backend (GET /logistics/stock-batches).
 * Response memuat `data` (batch ter-mapping), `summary` (agregat) dan `meta`
 * (paginasi). Perhitungan status kedaluwarsa & sisa stok dilakukan di sini
 * agar UI cukup mengonsumsi bentuk yang konsisten.
 */
export async function fetchStockBatches(params?: {
	search?: string;
	warehouse_id?: string;
	status?: string;
	page?: number;
	limit?: number;
}): Promise<StockBatch[]> {
	isLoadingPurchases = true;
	error = null;
	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.warehouse_id && params.warehouse_id !== 'ALL') {
			query.set('warehouse_id', params.warehouse_id);
		}
		if (params?.status && params.status !== 'ALL') {
			query.set('status', params.status);
		}
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));
		const qs = query.toString();

		const result = await api.get<StockBatchListResponse>(
			`/logistics/stock-batches${qs ? `?${qs}` : ''}`
		);

		const nowDate = new Date();
		const ninetyDaysFromNow = new Date();
		ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

		const data = (result.data ?? []).map((batch: any) => {
			const expDate = batch.exp_date ? new Date(batch.exp_date) : null;
			const currentStock = Number(batch.current_stock ?? 0);
			const initialStock = Number(batch.initial_stock ?? 0);

			const isExpired = expDate ? expDate < nowDate : false;
			const isNearExpiry = expDate ? !isExpired && expDate <= ninetyDaysFromNow : false;
			const isEmpty = currentStock <= 0;

			return {
				id: batch.id,
				batch_number: batch.batch_number,
				exp_date: batch.exp_date,
				buy_price: Number(batch.buy_price ?? 0),
				initial_stock: initialStock,
				current_stock: currentStock,
				// Sisa stok dalam persen — 100 berarti batch belum tersentuh.
				remaining_percentage:
					initialStock > 0 ? Math.round((currentStock / initialStock) * 100) : 0,
				status: isEmpty
					? 'OUT_OF_STOCK'
					: isExpired
						? 'EXPIRED'
						: isNearExpiry
							? 'NEAR_EXPIRY'
							: 'AVAILABLE',
				is_empty: isEmpty,
				is_expired: isExpired,
				is_near_expiry: isNearExpiry,
				product: batch.product
					? {
							id: batch.product.id,
							code: batch.product.code,
							name: batch.product.name,
							unit: batch.product.unit,
							category: batch.product.category
						}
					: null,
				warehouse: batch.warehouse
					? {
							id: batch.warehouse.id,
							name: batch.warehouse.name,
							type: batch.warehouse.type
						}
					: null,
				createdAt: batch.createdAt,
				updatedAt: batch.updatedAt
			} as StockBatch;
		});

		purchaseRows = data;
		purchaseSummary = result.summary ?? null;
		purchaseMeta = result.meta ?? null;
		return purchaseRows;
	} catch (err) {
		error = parseError(err);
		return purchaseRows;
	} finally {
		isLoadingPurchases = false;
	}
}

/* ------------------------------------------------------------------ */
/* Inventory logs (audit trail)                                        */
/* ------------------------------------------------------------------ */

export async function fetchInventoryLogs(params?: {
	search?: string;
	type?: string;
	warehouse_id?: string;
	page?: number;
	limit?: number;
}): Promise<InventoryLog[]> {
	isLoadingLogs = true;
	error = null;
	try {
		await delay();
		const q = (params?.search ?? '').trim().toLowerCase();
		let rows = [...inventoryLogs];

		if (params?.type && params.type !== 'ALL') {
			rows = rows.filter((l) => l.type === params.type);
		}
		if (params?.warehouse_id && params.warehouse_id !== 'ALL') {
			rows = rows.filter((l) => l.warehouse_id === params.warehouse_id);
		}
		if (q) {
			rows = rows.filter((l) => {
				const name = getProduct(l.product_id)?.name.toLowerCase() ?? '';
				return (
					name.includes(q) ||
					(l.reference ?? '').toLowerCase().includes(q) ||
					(l.notes ?? '').toLowerCase().includes(q)
				);
			});
		}
		rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

		const { data, meta } = paginate(rows, params?.page ?? 1, params?.limit ?? 10);
		logRows = data;
		logMeta = meta;
		return data;
	} catch (err) {
		error = parseError(err);
		return [];
	} finally {
		isLoadingLogs = false;
	}
}

/* ------------------------------------------------------------------ */
/* Stock adjustment / opname                                           */
/* ------------------------------------------------------------------ */

export async function adjustStock(dto: {
	product_id: string;
	warehouse_id: string;
	new_stock: number;
	reason: string;
}): Promise<InventoryLog> {
	isSubmitting = true;
	error = null;
	try {
		await delay(460);
		const product = getProduct(dto.product_id);
		if (!product) throw new Error('Produk tidak ditemukan');
		if (!dto.reason?.trim()) throw new Error('Alasan penyesuaian wajib diisi');
		if (Number(dto.new_stock) < 0) throw new Error('Stok tidak boleh negatif');

		const row = ensureStockRow(dto.warehouse_id, dto.product_id);
		const diff = Number(dto.new_stock) - row.stock;
		row.stock = Number(dto.new_stock);
		row.updatedAt = now();

		const log: InventoryLog = {
			id: uid('log'),
			product_id: dto.product_id,
			warehouse_id: dto.warehouse_id,
			type: 'ADJUSTMENT',
			quantity: diff,
			balance_after: row.stock,
			reference: `OPN-${new Date().getFullYear()}-${String(++idCounter).slice(-4)}`,
			notes: dto.reason.trim(),
			actor: 'Petugas Logistik',
			createdAt: now()
		};
		inventoryLogs = [log, ...inventoryLogs];
		return log;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

/* ------------------------------------------------------------------ */
/* Stock requests (amprahan)                                           */
/* ------------------------------------------------------------------ */

export async function fetchStockRequests(params?: {
	search?: string;
	status?: string;
	page?: number;
	limit?: number;
}): Promise<StockRequest[]> {
	isLoadingRequests = true;
	error = null;
	try {
		await delay();
		const q = (params?.search ?? '').trim().toLowerCase();
		let rows = [...stockRequests];

		if (params?.status && params.status !== 'ALL') {
			rows = rows.filter((r) => r.status === params.status);
		}
		if (q) {
			rows = rows.filter(
				(r) =>
					r.no_trx.toLowerCase().includes(q) ||
					r.unit_name.toLowerCase().includes(q) ||
					r.requester.toLowerCase().includes(q)
			);
		}
		rows.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

		const { data, meta } = paginate(rows, params?.page ?? 1, params?.limit ?? 10);
		requestRows = data;
		requestMeta = meta;
		return data;
	} catch (err) {
		error = parseError(err);
		return [];
	} finally {
		isLoadingRequests = false;
	}
}

export async function approveStockRequest(
	id: string,
	approvals?: Record<string, number>
): Promise<StockRequest> {
	isSubmitting = true;
	error = null;
	try {
		await delay(420);
		const request = stockRequests.find((r) => r.id === id);
		if (!request) throw new Error('Permintaan tidak ditemukan');

		request.items.forEach((item) => {
			const qty = approvals?.[item.id];
			item.approved_qty =
				qty === undefined ? item.requested_qty : Math.max(0, Math.min(Number(qty), item.requested_qty));
		});
		request.status = 'APPROVED';
		request.handled_by = 'Petugas Logistik';
		return request;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

export async function rejectStockRequest(id: string, reason: string): Promise<StockRequest> {
	isSubmitting = true;
	error = null;
	try {
		await delay(400);
		const request = stockRequests.find((r) => r.id === id);
		if (!request) throw new Error('Permintaan tidak ditemukan');

		request.status = 'REJECTED';
		request.handled_by = 'Petugas Logistik';
		request.notes = reason?.trim() ? `Ditolak — ${reason.trim()}` : 'Ditolak oleh Petugas Logistik';
		request.items.forEach((item) => (item.approved_qty = 0));
		return request;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

/**
 * Proses pengeluaran barang dari gudang asal ke gudang tujuan.
 * Memicu mutasi TRANSFER_OUT (asal) dan TRANSFER_IN (tujuan).
 * Bila stok asal kurang -> status PARTIAL, bila cukup -> FULFILLED.
 */
export async function fulfillStockRequest(id: string): Promise<StockRequest> {
	isSubmitting = true;
	error = null;
	try {
		await delay(640);
		const request = stockRequests.find((r) => r.id === id);
		if (!request) throw new Error('Permintaan tidak ditemukan');
		if (request.status !== 'APPROVED' && request.status !== 'PARTIAL') {
			throw new Error('Hanya permintaan yang disetujui dapat dikirim');
		}

		let partial = false;
		const newLogs: InventoryLog[] = [];

		for (const item of request.items) {
			const want = item.approved_qty ?? item.requested_qty;
			if (want <= 0) continue;

			const source = ensureStockRow(request.from_warehouse_id, item.product_id);
			const destination = ensureStockRow(request.to_warehouse_id, item.product_id);
			const movable = Math.min(want, source.stock);

			if (movable < want) partial = true;
			if (movable <= 0) continue;

			source.stock -= movable;
			source.updatedAt = now();
			destination.stock += movable;
			destination.updatedAt = now();

			newLogs.push(
				{
					id: uid('log'),
					product_id: item.product_id,
					warehouse_id: request.from_warehouse_id,
					type: 'TRANSFER_OUT',
					quantity: -movable,
					balance_after: source.stock,
					reference: request.no_trx,
					notes: `Transfer ke ${request.unit_name}`,
					actor: 'Petugas Logistik',
					createdAt: now()
				},
				{
					id: uid('log'),
					product_id: item.product_id,
					warehouse_id: request.to_warehouse_id,
					type: 'TRANSFER_IN',
					quantity: movable,
					balance_after: destination.stock,
					reference: request.no_trx,
					notes: `Transfer dari Gudang Utama`,
					actor: 'Petugas Logistik',
					createdAt: now()
				}
			);

			item.approved_qty = movable;
		}

		inventoryLogs = [...newLogs, ...inventoryLogs];
		request.status = partial ? 'PARTIAL' : 'FULFILLED';
		request.handled_by = 'Petugas Logistik';
		return request;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmitting = false;
	}
}

/* ------------------------------------------------------------------ */
/* Store publik                                                        */
/* ------------------------------------------------------------------ */

export const logistik = {
	/* Master */
	get products(): Product[] {
		return masterProducts;
	},
	get warehouses(): Warehouse[] {
		return warehouses;
	},
	get mainWarehouses(): Warehouse[] {
		return warehouses.filter((w) => w.is_main);
	},

	/* Turunan */
	get lowStockRows(): LowStockRow[] {
		const rows: LowStockRow[] = [];
		for (const stock of warehouseStocks) {
			const product = getProduct(stock.product_id);
			const warehouse = getWarehouse(stock.warehouse_id);
			if (!product || !warehouse) continue;
			if (stock.stock <= product.min_stock) {
				rows.push({
					product,
					warehouse,
					stock: stock.stock,
					min_stock: product.min_stock,
					deficit: Math.max(0, product.min_stock - stock.stock)
				});
			}
		}
		return rows.sort((a, b) => b.deficit - a.deficit);
	},
	get pendingRequestCount(): number {
		return stockRequests.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length;
	},

	/* View state */
	get productRows(): Product[] {
		return productRows;
	},
	get productMeta(): MetaPagination | null {
		return productMeta;
	},
	get stockMatrix(): StockMatrixRow[] {
		return stockMatrix;
	},
	get logRows(): InventoryLog[] {
		return logRows;
	},
	get logMeta(): MetaPagination | null {
		return logMeta;
	},
	get purchaseRows(): StockBatch[] {
		return purchaseRows;
	},
	get purchaseMeta(): MetaPagination | null {
		return purchaseMeta;
	},
	get purchaseSummary(): StockBatchSummary | null {
		return purchaseSummary;
	},
	get requestRows(): StockRequest[] {
		return requestRows;
	},
	get requestMeta(): MetaPagination | null {
		return requestMeta;
	},

	/* Loading flags */
	get isLoadingProducts(): boolean {
		return isLoadingProducts;
	},
	get isLoadingStock(): boolean {
		return isLoadingStock;
	},
	get isLoadingLogs(): boolean {
		return isLoadingLogs;
	},
	get isLoadingPurchases(): boolean {
		return isLoadingPurchases;
	},
	get isLoadingRequests(): boolean {
		return isLoadingRequests;
	},
	get isLoadingWarehouses(): boolean {
		return isLoadingWarehouses;
	},
	get isSubmitting(): boolean {
		return isSubmitting;
	},
	get error(): string | null {
		return error;
	},

	/* Helpers */
	productById(id: string): Product | undefined {
		return getProduct(id);
	},
	warehouseById(id: string): Warehouse | undefined {
		return getWarehouse(id);
	},
	stockAt(warehouseId: string, productId: string): number {
		return getStock(warehouseId, productId);
	},
	totalStock(productId: string): number {
		return warehouseStocks
			.filter((s) => s.product_id === productId)
			.reduce((sum, s) => sum + s.stock, 0);
	},

	/* Actions */
	fetchWarehouses,
	fetchProducts,
	createProduct,
	updateProduct,
	deleteProduct,
	fetchStockMatrix,
	restockProduct,
	fetchStockBatches,
	fetchInventoryLogs,
	adjustStock,
	fetchStockRequests,
	approveStockRequest,
	rejectStockRequest,
	fulfillStockRequest
};
