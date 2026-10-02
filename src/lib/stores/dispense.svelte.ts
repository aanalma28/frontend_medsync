/* =========================================================================
 * Apoteker Dispense Store — Validasi Resep & Kontrol Stok Multi-Depo
 * -------------------------------------------------------------------------
 * Store ini melayani Dashboard Apoteker dengan fokus pada alur:
 *
 *   Resep Masuk  ->  Cek Stok Depo (WarehouseStock)  ->  DISPENSE
 *                                                \->  Jika kurang:
 *                                                     Ajukan Amprahan Darurat
 *                                                     ke Gudang Utama (Logistik)
 *
 * Mengikuti skema backend multi-gudang:
 *   Warehouses      -> lokasi penyimpanan fisik (Gudang Utama + Depo)
 *   Products        -> master katalog
 *   WarehouseStock  -> sisa stok aktual per produk per warehouse
 *   InventoryLogs   -> ledger audit (tipe DISPENSE mengurangi stok depo)
 *   StockRequests   -> amprahan dari unit operasional ke Gudang Utama
 *
 * Data di bawah ini DUMMY agar UI dapat berjalan mandiri; penggantian ke
 * endpoint asli cukup menukar isi tiap fungsi fetch/action.
 *
 * Endpoint backend yang direkomendasikan:
 *   GET    /warehouses
 *   GET    /prescriptions?warehouse_id=&status=PENDING
 *   POST   /prescriptions/:id/dispense      { verify_notes }
 *   POST   /stock-requests                  { from_warehouse_id, to_warehouse_id, items[] }
 * ========================================================================= */

import type { MetaPagination } from '$lib/stores/user.svelte';

export type { MetaPagination };

/* ------------------------------------------------------------------ */
/* Warehouses                                                          */
/* ------------------------------------------------------------------ */

export type WarehouseType = 'MAIN' | 'PHARMACY' | 'CLINIC' | 'WARD' | 'LAB';

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
	MAIN: 'Gudang Utama',
	PHARMACY: 'Depo Farmasi Rawat Jalan',
	CLINIC: 'Depo IGD / Poli',
	WARD: 'Depo Rawat Inap',
	LAB: 'Depo Laboratorium'
};

export interface Warehouse {
	id: string;
	code: string;
	name: string;
	type: WarehouseType;
	location?: string;
	is_active: boolean;
	is_main: boolean;
}

/* ------------------------------------------------------------------ */
/* Products & stock                                                    */
/* ------------------------------------------------------------------ */

export interface Product {
	id: string;
	code: string;
	name: string;
	unit: string;
	min_stock: number;
}

export interface WarehouseStock {
	warehouse_id: string;
	product_id: string;
	stock: number;
}

export interface LowStockRow {
	product: Product;
	stock: number;
	min_stock: number;
	deficit: number;
}

/* ------------------------------------------------------------------ */
/* Prescriptions                                                       */
/* ------------------------------------------------------------------ */

export type PrescriptionStatus = 'PENDING' | 'DISPENSED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';

export type PrescriptionPriority = 'NORMAL' | 'URGENT' | 'EMERGENCY';

export const PRESCRIPTION_PRIORITY_LABELS: Record<PrescriptionPriority, string> = {
	NORMAL: 'Normal',
	URGENT: 'Urgent',
	EMERGENCY: 'Darurat'
};

export interface PrescriptionItem {
	id: string;
	product_id: string;
	/** Jumlah yang diminta dokter. */
	quantity: number;
	/** Aturan pakai / instruksi (mis. "3 x 1 sehari setelah makan"). */
	rules_using: string;
}

export interface Prescription {
	id: string;
	no_trx: string;
	recipe_date: string;
	status: PrescriptionStatus;
	priority: PrescriptionPriority;
	patient_name: string;
	medical_record_number: string;
	patient_phone?: string;
	doctor_name: string;
	/** Depo tujuan penyerahan obat (WarehouseStock scope). */
	warehouse_id: string;
	notes?: string;
	verify_notes?: string;
	dispensed_at?: string;
	items: PrescriptionItem[];
}

/** Item resep yang sudah dilengkapi info stok depo aktif (untuk UI). */
export interface PrescriptionItemView extends PrescriptionItem {
	product_code: string;
	product_name: string;
	unit: string;
	min_stock: number;
	stock_in_warehouse: number;
	available: boolean;
	shortfall: number;
}

/** Resep yang sudah dievaluasi terhadap ketersediaan stok depo. */
export interface PrescriptionView extends Prescription {
	items: PrescriptionItemView[];
	total_items: number;
	total_ready: number;
	has_shortage: boolean;
}

export interface DispenseResult {
	ok: boolean;
	message: string;
	shortages: PrescriptionItemView[];
	prescription: Prescription | null;
}

/* ------------------------------------------------------------------ */
/* Inventory logs & Stock requests                                     */
/* ------------------------------------------------------------------ */

export type InventoryLogType = 'DISPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';

export interface InventoryLog {
	id: string;
	product_id: string;
	product_name?: string;
	warehouse_id: string;
	type: InventoryLogType;
	/** Bertanda: negatif = keluar (DISPENSE), positif = masuk. */
	quantity: number;
	balance_after: number;
	reference?: string;
	notes?: string;
	actor?: string;
	createdAt: string;
}

export type StockRequestStatus = 'PENDING' | 'APPROVED' | 'PARTIAL' | 'FULFILLED' | 'REJECTED';

export interface StockRequestItem {
	product_id: string;
	product_name?: string;
	unit?: string;
	requested_qty: number;
}

export interface StockRequest {
	id: string;
	no_trx: string;
	from_warehouse_id: string;
	to_warehouse_id: string;
	requested_at: string;
	requested_by: string;
	status: StockRequestStatus;
	priority: 'NORMAL' | 'URGENT';
	notes?: string;
	items: StockRequestItem[];
}

export interface EmergencyRequestDraft {
	prescription_id: string;
	to_warehouse_id: string;
	from_warehouse_id?: string;
	notes?: string;
	items: { product_id: string; requested_qty: number }[];
}

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

let seq = 4000;
function uid(prefix: string): string {
	return `${prefix}-${++seq}`;
}

function nowISO(): string {
	return new Date().toISOString();
}

function hoursAgo(h: number): string {
	return new Date(Date.now() - h * 3_600_000).toISOString();
}

function delay(ms = 380): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

function seedWarehouses(): Warehouse[] {
	return [
		{ id: 'wh-01', code: 'GU-01', name: 'Gudang Utama', type: 'MAIN', location: 'Gedung A Lantai 1', is_active: true, is_main: true },
		{ id: 'wh-02', code: 'DF-01', name: 'Depo Farmasi Rawat Jalan', type: 'PHARMACY', location: 'Gedung A Lantai 2', is_active: true, is_main: false },
		{ id: 'wh-03', code: 'DP-01', name: 'Depo IGD / Poli', type: 'CLINIC', location: 'Gedung B Lantai 1', is_active: true, is_main: false },
		{ id: 'wh-04', code: 'DR-01', name: 'Depo Rawat Inap', type: 'WARD', location: 'Gedung C Lantai 2', is_active: true, is_main: false },
		{ id: 'wh-05', code: 'DL-01', name: 'Depo Laboratorium', type: 'LAB', location: 'Gedung C Lantai 1', is_active: true, is_main: false }
	];
}

function seedProducts(): Product[] {
	return [
		{ id: 'prd-01', code: 'OBT-0001', name: 'Paracetamol 500 mg Tablet', unit: 'Strip', min_stock: 50 },
		{ id: 'prd-02', code: 'OBT-0002', name: 'Amoxicillin 500 mg Kapsul', unit: 'Strip', min_stock: 40 },
		{ id: 'prd-03', code: 'OBT-0003', name: 'Omeprazole 20 mg Kapsul', unit: 'Box', min_stock: 20 },
		{ id: 'prd-04', code: 'OBT-0004', name: 'Ibuprofen 400 mg Tablet', unit: 'Strip', min_stock: 40 },
		{ id: 'prd-05', code: 'OBT-0005', name: 'Amlodipine 10 mg Tablet', unit: 'Strip', min_stock: 30 },
		{ id: 'prd-06', code: 'OBT-0006', name: 'Metformin 500 mg Tablet', unit: 'Strip', min_stock: 30 },
		{ id: 'prd-07', code: 'OBT-0007', name: 'Cetirizine 10 mg Tablet', unit: 'Strip', min_stock: 25 },
		{ id: 'prd-08', code: 'OBT-0008', name: 'Salbutamol Inhaler 100 mcg', unit: 'Botol', min_stock: 10 }
	];
}

function seedStocks(): WarehouseStock[] {
	// [product_id, Gudang Utama, Depo Rawat Jalan, Depo IGD, Depo Ranap, Depo Lab]
	const grid: Array<[string, number, number, number, number, number]> = [
		['prd-01', 1450, 320, 140, 200, 0],
		['prd-02', 620, 60, 25, 80, 0],
		['prd-03', 210, 48, 12, 30, 0],
		['prd-04', 480, 120, 45, 60, 0],
		['prd-05', 340, 90, 30, 40, 0],
		['prd-06', 400, 40, 18, 50, 0],
		['prd-07', 260, 70, 22, 30, 0],
		['prd-08', 45, 8, 3, 5, 0]
	];
	const warehouseIds = ['wh-01', 'wh-02', 'wh-03', 'wh-04', 'wh-05'];
	const rows: WarehouseStock[] = [];
	for (const [productId, ...values] of grid) {
		values.forEach((stock, index) => {
			rows.push({ warehouse_id: warehouseIds[index], product_id: productId, stock });
		});
	}
	return rows;
}

function seedPrescriptions(): Prescription[] {
	return [
		{
			id: 'rsp-01',
			no_trx: 'RES-2026-1187',
			recipe_date: hoursAgo(1),
			status: 'PENDING',
			priority: 'URGENT',
			patient_name: 'Budi Santoso',
			medical_record_number: 'RM-2026-002',
			patient_phone: '085678901234',
			doctor_name: 'dr. Sari Wijaya',
			warehouse_id: 'wh-03',
			notes: 'Pasien IGD, demam tinggi + batuk.',
			items: [
				{ id: 'rqi-01', product_id: 'prd-01', quantity: 20, rules_using: '3 x 1 sehari' },
				{ id: 'rqi-02', product_id: 'prd-02', quantity: 30, rules_using: '3 x 1 sehari, habiskan' },
				{ id: 'rqi-03', product_id: 'prd-07', quantity: 15, rules_using: '1 x 1 malam' }
			]
		},
		{
			id: 'rsp-02',
			no_trx: 'RES-2026-1188',
			recipe_date: hoursAgo(2),
			status: 'PENDING',
			priority: 'NORMAL',
			patient_name: 'Ayu Putri Lestari',
			medical_record_number: 'RM-2026-001',
			patient_phone: '081234567890',
			doctor_name: 'dr. Handoko Prasetyo',
			warehouse_id: 'wh-02',
			items: [
				{ id: 'rqi-04', product_id: 'prd-01', quantity: 10, rules_using: '3 x 1 sehari' },
				{ id: 'rqi-05', product_id: 'prd-05', quantity: 10, rules_using: '1 x 1 pagi' },
				{ id: 'rqi-06', product_id: 'prd-06', quantity: 20, rules_using: '2 x 1 sehari' }
			]
		},
		{
			id: 'rsp-03',
			no_trx: 'RES-2026-1189',
			recipe_date: hoursAgo(3),
			status: 'PENDING',
			priority: 'EMERGENCY',
			patient_name: 'Dewi Lestari',
			medical_record_number: 'RM-2026-005',
			patient_phone: '081298765432',
			doctor_name: 'dr. Sari Wijaya',
			warehouse_id: 'wh-02',
			notes: 'Perlu antibiotik dosis tinggi, pasien pulang hari ini.',
			items: [{ id: 'rqi-07', product_id: 'prd-02', quantity: 100, rules_using: '3 x 1 sehari, habiskan' }]
		},
		{
			id: 'rsp-04',
			no_trx: 'RES-2026-1190',
			recipe_date: hoursAgo(4),
			status: 'PENDING',
			priority: 'NORMAL',
			patient_name: 'Siti Aminah',
			medical_record_number: 'RM-2026-003',
			patient_phone: '087890123456',
			doctor_name: 'dr. Handoko Prasetyo',
			warehouse_id: 'wh-02',
			items: [
				{ id: 'rqi-08', product_id: 'prd-03', quantity: 12, rules_using: '2 x 1 sebelum makan' },
				{ id: 'rqi-09', product_id: 'prd-04', quantity: 10, rules_using: '2 x 1 setelah makan' }
			]
		},
		{
			id: 'rsp-05',
			no_trx: 'RES-2026-1191',
			recipe_date: hoursAgo(5),
			status: 'PENDING',
			priority: 'NORMAL',
			patient_name: 'Rudi Hartono',
			medical_record_number: 'RM-2026-008',
			doctor_name: 'dr. Bagus Nugroho',
			warehouse_id: 'wh-04',
			notes: 'Pasien asma rawat inap.',
			items: [{ id: 'rqi-10', product_id: 'prd-08', quantity: 10, rules_using: '2 puff jika sesak' }]
		}
	];
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let warehouses = $state<Warehouse[]>(seedWarehouses());
let products = $state<Product[]>(seedProducts());
let stocks = $state<WarehouseStock[]>(seedStocks());
let prescriptions = $state<Prescription[]>(seedPrescriptions());

let logs = $state<InventoryLog[]>([]);
let stockRequests = $state<StockRequest[]>([]);

let activeWarehouseId = $state<string>('');

let isLoading = $state(false);
let isDispensing = $state(false);
let isSubmittingRequest = $state(false);
let error = $state<string | null>(null);

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

function getProduct(id: string): Product | undefined {
	return products.find((p) => p.id === id);
}

function getWarehouse(id: string): Warehouse | undefined {
	return warehouses.find((w) => w.id === id);
}

function getStock(warehouseId: string, productId: string): number {
	return (
		stocks.find((s) => s.warehouse_id === warehouseId && s.product_id === productId)?.stock ?? 0
	);
}

/** Cari row stok, buat bila belum ada, lalu kembalikan proxy-nya agar reactive. */
function ensureStockRow(warehouseId: string, productId: string): WarehouseStock {
	let row = stocks.find((s) => s.warehouse_id === warehouseId && s.product_id === productId);
	if (!row) {
		stocks.push({ warehouse_id: warehouseId, product_id: productId, stock: 0 });
		row = stocks.find((s) => s.warehouse_id === warehouseId && s.product_id === productId);
	}
	return row as WarehouseStock;
}

/** Lengkapi satu item resep dengan info produk + stok depo terkait. */
function enrichItem(item: PrescriptionItem, warehouseId: string): PrescriptionItemView {
	const product = getProduct(item.product_id);
	const stock = getStock(warehouseId, item.product_id);
	return {
		...item,
		product_code: product?.code ?? '-',
		product_name: product?.name ?? 'Produk tidak dikenal',
		unit: product?.unit ?? 'Unit',
		min_stock: product?.min_stock ?? 0,
		stock_in_warehouse: stock,
		available: stock >= item.quantity,
		shortfall: Math.max(0, item.quantity - stock)
	};
}

/** Evaluasi satu resep terhadap ketersediaan stok pada depo tujuannya. */
function evaluatePrescription(p: Prescription): PrescriptionView {
	const items = p.items.map((item) => enrichItem(item, p.warehouse_id));
	const total_ready = items.filter((i) => i.available).length;
	return {
		...p,
		items,
		total_items: items.length,
		total_ready,
		has_shortage: items.some((i) => !i.available)
	};
}

const PRIORITY_ORDER: Record<PrescriptionPriority, number> = {
	EMERGENCY: 0,
	URGENT: 1,
	NORMAL: 2
};

/* ------------------------------------------------------------------ */
/* Fetch: Warehouses                                                   */
/* ------------------------------------------------------------------ */

export async function fetchWarehouses(): Promise<Warehouse[]> {
	isLoading = true;
	error = null;
	try {
		await delay(200);
		// Real: const res = await api.get<{ data: Warehouse[] }>('/warehouses');
		return warehouses;
	} catch (err) {
		error = parseError(err);
		return [];
	} finally {
		isLoading = false;
	}
}

/** Pilih depo aktif — semua transaksi selanjutnya merujuk ke warehouse_id ini. */
export function selectWarehouse(id: string): void {
	activeWarehouseId = id;
}

/* ------------------------------------------------------------------ */
/* Fetch: Prescription queue                                           */
/* ------------------------------------------------------------------ */

export async function fetchPrescriptionQueue(params?: {
	warehouse_id?: string;
	status?: string;
	search?: string;
}): Promise<Prescription[]> {
	isLoading = true;
	error = null;
	try {
		await delay();
		// Real: const q = new URLSearchParams(...); await api.get(`/prescriptions?${q}`);
		let rows = [...prescriptions];

		const whId = params?.warehouse_id ?? activeWarehouseId;
		if (whId) rows = rows.filter((p) => p.warehouse_id === whId);

		if (params?.status && params.status !== 'ALL') {
			rows = rows.filter((p) => p.status === params.status);
		}

		const q = (params?.search ?? '').trim().toLowerCase();
		if (q) {
			rows = rows.filter(
				(p) =>
					p.patient_name.toLowerCase().includes(q) ||
					p.no_trx.toLowerCase().includes(q) ||
					p.medical_record_number.toLowerCase().includes(q)
			);
		}
		return rows;
	} catch (err) {
		error = parseError(err);
		return [];
	} finally {
		isLoading = false;
	}
}

/* ------------------------------------------------------------------ */
/* Action: Validasi & Serahkan Obat (DISPENSE)                         */
/* ------------------------------------------------------------------ */

/**
 * Cek stok aktual di WarehouseStock depo terkait, lalu:
 *  - Jika SEMUA item tersedia  -> potong stok + catat log DISPENSE, status DISPENSED.
 *  - Jika ada item kurang      -> TIDAK memotong stok, kembalikan daftar shortage
 *                                 agar UI bisa menampilkan tombol amprahan darurat.
 */
export async function validateAndDispense(
	id: string,
	verifyNotes?: string
): Promise<DispenseResult> {
	isDispensing = true;
	error = null;
	try {
		await delay(520);
		// Real: await api.post(`/prescriptions/${id}/dispense`, { verify_notes: verifyNotes });

		const prescription = prescriptions.find((p) => p.id === id);
		if (!prescription) throw new Error('Resep tidak ditemukan');
		if (prescription.status === 'DISPENSED') {
			throw new Error('Resep ini sudah pernah ditebus');
		}

		const warehouseId = prescription.warehouse_id;
		const warehouseName = getWarehouse(warehouseId)?.name ?? 'depo';

		// 1) Cek stok real-time per item
		const shortages: PrescriptionItemView[] = prescription.items
			.map((item) => enrichItem(item, warehouseId))
			.filter((item) => !item.available);

		if (shortages.length > 0) {
			const detail = shortages
				.map(
					(s) =>
						`${s.product_name} (butuh ${s.quantity} ${s.unit}, tersedia ${s.stock_in_warehouse})`
				)
				.join('; ');
			const message = `Stok tidak mencukupi di ${warehouseName}. Kurang: ${detail}.`;
			error = message;
			return { ok: false, message, shortages, prescription: null };
		}

		// 2) Stok cukup -> potong stok + catat log DISPENSE
		const createdLogs: InventoryLog[] = [];
		for (const item of prescription.items) {
			const row = ensureStockRow(warehouseId, item.product_id);
			row.stock -= item.quantity;
			const product = getProduct(item.product_id);
			createdLogs.push({
				id: uid('log'),
				product_id: item.product_id,
				product_name: product?.name,
				warehouse_id: warehouseId,
				type: 'DISPENSE',
				quantity: -item.quantity,
				balance_after: row.stock,
				reference: prescription.no_trx,
				notes: `Penyerahan resep ${prescription.patient_name}`,
				actor: 'Apoteker',
				createdAt: nowISO()
			});
		}
		logs = [...createdLogs, ...logs];

		prescription.status = 'DISPENSED';
		prescription.verify_notes = verifyNotes?.trim() || undefined;
		prescription.dispensed_at = nowISO();

		return {
			ok: true,
			message: `Resep ${prescription.no_trx} atas nama ${prescription.patient_name} berhasil ditebus. Stok depo otomatis dipotong.`,
			shortages: [],
			prescription
		};
	} catch (err) {
		const message = parseError(err);
		error = message;
		return { ok: false, message, shortages: [], prescription: null };
	} finally {
		isDispensing = false;
	}
}

/* ------------------------------------------------------------------ */
/* Action: Ajukan Amprahan Darurat ke Gudang Utama                     */
/* ------------------------------------------------------------------ */

export async function requestEmergencyStock(dto: EmergencyRequestDraft): Promise<StockRequest> {
	isSubmittingRequest = true;
	error = null;
	try {
		await delay(520);
		// Real: await api.post('/stock-requests', dto);

		const fromWarehouseId = dto.from_warehouse_id ?? warehouses.find((w) => w.is_main)?.id ?? '';
		if (!fromWarehouseId) throw new Error('Gudang Utama (sumber stok) tidak ditemukan');
		if (!dto.items.length) throw new Error('Tidak ada item obat untuk diajukan');

		const req: StockRequest = {
			id: uid('req'),
			no_trx: `RO-${new Date().getFullYear()}-${String(++seq).slice(-4)}`,
			from_warehouse_id: fromWarehouseId,
			to_warehouse_id: dto.to_warehouse_id,
			requested_at: nowISO(),
			requested_by: 'Apoteker',
			status: 'PENDING',
			priority: 'URGENT',
			notes: dto.notes?.trim() || 'Amprahan darurat dari depo apoteker',
			items: dto.items.map((i) => {
				const product = getProduct(i.product_id);
				return {
					product_id: i.product_id,
					product_name: product?.name,
					unit: product?.unit,
					requested_qty: Number(i.requested_qty) || 0
				};
			})
		};

		stockRequests = [req, ...stockRequests];
		return req;
	} catch (err) {
		const message = parseError(err);
		error = message;
		throw new Error(message);
	} finally {
		isSubmittingRequest = false;
	}
}

/* ------------------------------------------------------------------ */
/* Public store                                                        */
/* ------------------------------------------------------------------ */

export const dispense = {
	/* Master */
	get warehouses(): Warehouse[] {
		return warehouses;
	},
	get depoWarehouses(): Warehouse[] {
		return warehouses.filter((w) => !w.is_main && w.is_active);
	},
	get mainWarehouse(): Warehouse | null {
		return warehouses.find((w) => w.is_main) ?? null;
	},
	get products(): Product[] {
		return products;
	},

	/* Konteks depo aktif */
	get activeWarehouseId(): string {
		return activeWarehouseId;
	},
	get activeWarehouse(): Warehouse | null {
		return getWarehouse(activeWarehouseId) ?? null;
	},

	/* Queue & hasil evaluasi */
	get prescriptions(): Prescription[] {
		return prescriptions;
	},
	get activeQueue(): PrescriptionView[] {
		if (!activeWarehouseId) return [];
		return prescriptions
			.filter((p) => p.warehouse_id === activeWarehouseId)
			.filter((p) => p.status === 'PENDING' || p.status === 'PARTIAL')
			.map(evaluatePrescription)
			.sort((a, b) => {
				const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
				if (byPriority !== 0) return byPriority;
				return new Date(a.recipe_date).getTime() - new Date(b.recipe_date).getTime();
			});
	},
	evaluatePrescription,

	/* Stok kritis di depo aktif (di bawah / sama dengan min_stock) */
	get lowStockProducts(): LowStockRow[] {
		if (!activeWarehouseId) return [];
		const rows: LowStockRow[] = [];
		for (const product of products) {
			const stock = getStock(activeWarehouseId, product.id);
			if (stock <= product.min_stock) {
				rows.push({
					product,
					stock,
					min_stock: product.min_stock,
					deficit: Math.max(0, product.min_stock - stock)
				});
			}
		}
		return rows.sort((a, b) => b.deficit - a.deficit);
	},

	/* Log & amprahan */
	get logs(): InventoryLog[] {
		return logs;
	},
	get stockRequests(): StockRequest[] {
		return stockRequests;
	},
	get pendingRequests(): StockRequest[] {
		return stockRequests.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED');
	},

	/* Loading & error */
	get isLoading(): boolean {
		return isLoading;
	},
	get isDispensing(): boolean {
		return isDispensing;
	},
	get isSubmittingRequest(): boolean {
		return isSubmittingRequest;
	},
	get error(): string | null {
		return error;
	},
	clearError(): void {
		error = null;
	},

	/* Helpers */
	warehouseById(id: string): Warehouse | undefined {
		return getWarehouse(id);
	},
	stockAt(warehouseId: string, productId: string): number {
		return getStock(warehouseId, productId);
	},

	/* Actions */
	fetchWarehouses,
	selectWarehouse,
	fetchPrescriptionQueue,
	validateAndDispense,
	requestEmergencyStock
};
