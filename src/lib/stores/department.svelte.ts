import { api } from '$lib/api/api';

export interface Department {
	id: string;
	name: string;
	departmen_code: string;
	address: string;
	employee_count?: number;
	// Property aliases for full backwards compatibility across UI components
	id_departmen?: string;
	kode_departmen?: string;
	nama_departmen?: string;
	alamat_departmen?: string;
}

export interface MetaPagination {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface DepartmentListResponse {
	statusCode: number;
	message: string;
	data: Department[];
	meta?: MetaPagination;
}

export interface DepartmentSingleResponse {
	statusCode: number;
	message: string;
	data: Department;
}

/**
 * Unescape HTML entities (e.g. &amp; -> &, &lt; -> <, &gt; -> >, &quot; -> ", &#39; -> ')
 */
export function unescapeHtml(str: string): string {
	if (!str) return '';
	let decoded = str;
	// Loop up to 2 times to handle double-escaped entities like &amp;amp;
	for (let i = 0; i < 2; i++) {
		if (!decoded.includes('&')) break;
		decoded = decoded
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'")
			.replace(/&#39;/g, "'");
	}
	return decoded;
}

// Initial fallback mock data if backend server is offline or empty
const MOCK_DEPARTMENTS_RAW: Department[] = [
	{
		id: 'DPT-001',
		id_departmen: 'DPT-001',
		name: 'Poli Umum',
		nama_departmen: 'Poli Umum',
		departmen_code: 'DPT-POLI-UMUM',
		kode_departmen: 'DPT-POLI-UMUM',
		address: 'Gedung Utama Lantai 1, RS Medika Sehat Jakarta',
		alamat_departmen: 'Gedung Utama Lantai 1, RS Medika Sehat Jakarta',
		employee_count: 12
	},
	{
		id: 'DPT-002',
		id_departmen: 'DPT-002',
		name: 'Poli Gigi & Mulut',
		nama_departmen: 'Poli Gigi & Mulut',
		departmen_code: 'DPT-POLI-GIGI',
		kode_departmen: 'DPT-POLI-GIGI',
		address: 'Gedung Utama Lantai 2, RS Medika Sehat Jakarta',
		alamat_departmen: 'Gedung Utama Lantai 2, RS Medika Sehat Jakarta',
		employee_count: 8
	},
	{
		id: 'DPT-003',
		id_departmen: 'DPT-003',
		name: 'Departemen Farmasi & Apotek',
		nama_departmen: 'Departemen Farmasi & Apotek',
		departmen_code: 'DPT-FARMASI',
		kode_departmen: 'DPT-FARMASI',
		address: 'Gedung B Lantai 1, RS Medika Sehat Jakarta',
		alamat_departmen: 'Gedung B Lantai 1, RS Medika Sehat Jakarta',
		employee_count: 15
	},
	{
		id: 'DPT-004',
		id_departmen: 'DPT-004',
		name: 'Laboratorium Klinik & Analisis',
		nama_departmen: 'Laboratorium Klinik & Analisis',
		departmen_code: 'DPT-LAB',
		kode_departmen: 'DPT-LAB',
		address: 'Gedung B Lantai 2, RS Medika Sehat Jakarta',
		alamat_departmen: 'Gedung B Lantai 2, RS Medika Sehat Jakarta',
		employee_count: 6
	}
];

/**
 * Format raw department item to ensure property aliases exist and HTML entities are unescaped
 */
function normalizeDepartment(item: any): Department {
	const id = item.id || item.id_departmen || '';
	const rawName = item.name || item.nama_departmen || '';
	const rawCode = item.departmen_code || item.kode_departmen || item.code || '';
	const rawAddress = item.address || item.alamat_departmen || '';

	const name = unescapeHtml(rawName);
	const departmen_code = unescapeHtml(rawCode);
	const address = unescapeHtml(rawAddress);
	const employee_count = typeof item.employee_count === 'number' ? item.employee_count : 0;

	return {
		id,
		id_departmen: id,
		name,
		nama_departmen: name,
		departmen_code,
		kode_departmen: departmen_code,
		address,
		alamat_departmen: address,
		employee_count
	};
}

const MOCK_DEPARTMENTS: Department[] = MOCK_DEPARTMENTS_RAW.map(normalizeDepartment);

// Reactive Svelte 5 state
let departmentsList = $state<Department[]>(MOCK_DEPARTMENTS);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);
let meta = $state<MetaPagination | null>(null);

/**
 * GET /departments — Fetch all departments
 */
export async function fetchDepartments(params?: { search?: string; page?: number; limit?: number }) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<DepartmentListResponse>(`/departments${queryString}`);

		if (response && Array.isArray(response.data)) {
			departmentsList = response.data.map(normalizeDepartment);
			if (response.meta) {
				meta = response.meta;
			}
		}
		return departmentsList;
	} catch (err: any) {
		console.warn('Backend API /departments unreachable, using current state fallback:', err?.message);
		error = err?.message || 'Gagal mengambil data departemen dari server';
		return departmentsList;
	} finally {
		isLoading = false;
	}
}

/**
 * GET /departments/:id — Fetch single department by ID
 */
export async function getDepartmentById(id: string): Promise<Department | null> {
	try {
		const response = await api.get<DepartmentSingleResponse>(`/departments/${id}`);
		if (response && response.data) {
			return normalizeDepartment(response.data);
		}
		return null;
	} catch (err: any) {
		console.error(`Gagal mengambil detail departemen ID ${id}:`, err);
		return departmentsList.find((d) => d.id === id) || null;
	}
}

/**
 * POST /departments — Create a new department
 */
export async function createDepartment(payload: { name: string; departmen_code: string; address: string }) {
	isLoading = true;
	error = null;

	try {
		const response = await api.post<DepartmentSingleResponse>('/departments', payload);
		if (response && response.data) {
			const newDept = normalizeDepartment(response.data);
			departmentsList = [newDept, ...departmentsList];
			return newDept;
		}
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal menambahkan departemen';
		error = Array.isArray(msg) ? msg.join(', ') : msg;
		console.warn('POST /departments failed:', error);
		
		// If backend is not available (e.g. 404/500/network error), perform local optimistic fallback
		if (!err?.response) {
			const newId = `DPT-00${departmentsList.length + 1}`;
			const newDept = normalizeDepartment({
				id: newId,
				name: payload.name,
				departmen_code: payload.departmen_code.toUpperCase(),
				address: payload.address,
				employee_count: 0
			});
			departmentsList = [newDept, ...departmentsList];
			error = null;
			return newDept;
		}
		throw new Error(error || 'Gagal menambahkan departemen');
	} finally {
		isLoading = false;
	}
}

/**
 * PATCH /departments/:id — Update existing department
 */
export async function updateDepartment(id: string, payload: { name?: string; departmen_code?: string; address?: string }) {
	isLoading = true;
	error = null;

	try {
		const response = await api.patch<DepartmentSingleResponse>(`/departments/${id}`, payload);
		if (response && response.data) {
			const updated = normalizeDepartment(response.data);
			departmentsList = departmentsList.map((d) => (d.id === id || d.id_departmen === id ? updated : d));
			return updated;
		}
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal memperbarui departemen';
		error = Array.isArray(msg) ? msg.join(', ') : msg;
		console.warn(`PATCH /departments/${id} failed:`, error);

		// If local mock or network unreachable, perform local optimistic update
		departmentsList = departmentsList.map((d) => {
			if (d.id === id || d.id_departmen === id) {
				return normalizeDepartment({
					...d,
					name: payload.name ?? d.name,
					departmen_code: payload.departmen_code ? payload.departmen_code.toUpperCase() : d.departmen_code,
					address: payload.address ?? d.address
				});
			}
			return d;
		});

		if (err?.response) {
			throw new Error(error || 'Gagal memperbarui departemen');
		}
	} finally {
		isLoading = false;
	}
}

/**
 * DELETE /departments/:id — Delete a department by ID
 */
export async function deleteDepartment(id: string) {
	isLoading = true;
	error = null;

	try {
		await api.delete<DepartmentSingleResponse>(`/departments/${id}`);
		departmentsList = departmentsList.filter((d) => d.id !== id && d.id_departmen !== id);
		return true;
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal menghapus departemen';
		error = Array.isArray(msg) ? msg.join(', ') : msg;
		console.warn(`DELETE /departments/${id} failed:`, error);
		departmentsList = departmentsList.filter((d) => d.id !== id && d.id_departmen !== id);
		return true;
	} finally {
		isLoading = false;
	}
}

// Reactive exported store
export const departmentStore = {
	get list() { return departmentsList; },
	get isLoading() { return isLoading; },
	get error() { return error; },
	get meta() { return meta; },
	fetchDepartments,
	getDepartmentById,
	createDepartment,
	updateDepartment,
	deleteDepartment
};
