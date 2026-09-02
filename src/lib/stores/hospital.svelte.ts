import { api } from '$lib/api/api';

export interface HospitalOwner {
	id: string;
	name: string;
	email: string;
	role: string;
}

export interface HospitalDepartmentItem {
	id: string;
	name: string;
	departmen_code: string;
	is_active: boolean;
	createdAt?: string;
}

export interface Hospital {
	id: string;
	hospital_code: string;
	name: string;
	address: string;
	is_active: boolean;
	user_id?: string;
	owner?: HospitalOwner | null;
	department_count?: number;
	departments?: HospitalDepartmentItem[];
	createdAt?: string;
	updatedAt?: string;
	// Property aliases for full UI backwards compatibility
	id_hospital?: string;
	kode_hospital?: string;
	nama_hospital?: string;
	alamat_hospital?: string;
}

export interface MetaPagination {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface HospitalListResponse {
	statusCode: number;
	message: string;
	data: Hospital[];
	meta?: MetaPagination;
}

export interface HospitalSingleResponse {
	statusCode: number;
	message: string;
	data: Hospital;
}

export interface CreateHospitalPayload {
	name: string;
	hospital_code: string;
	address: string;
	user_id?: string;
}

export interface UpdateHospitalPayload {
	name?: string;
	hospital_code?: string;
	address?: string;
	is_active?: boolean;
	user_id?: string;
}

/**
 * Unescape HTML entities (e.g. &amp; -> &, &lt; -> <, &gt; -> >, &quot; -> ", &#39; -> ')
 */
export function unescapeHtml(str: string): string {
	if (!str) return '';
	let decoded = str;
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

/**
 * Format raw hospital item to ensure property aliases exist and HTML entities are unescaped
 */
function normalizeHospital(item: any): Hospital {
	const id = item.id || item.id_hospital || '';
	const rawName = item.name || item.nama_hospital || '';
	const rawCode = item.hospital_code || item.kode_hospital || '';
	const rawAddress = item.address || item.alamat_hospital || '';
	const is_active = typeof item.is_active === 'boolean' ? item.is_active : true;

	const name = unescapeHtml(rawName);
	const hospital_code = unescapeHtml(rawCode);
	const address = unescapeHtml(rawAddress);
	const department_count = typeof item.department_count === 'number' ? item.department_count : 0;

	return {
		...item,
		id,
		id_hospital: id,
		name,
		nama_hospital: name,
		hospital_code,
		kode_hospital: hospital_code,
		address,
		alamat_hospital: address,
		is_active,
		department_count
	};
}

// Reactive state (Svelte 5 runes)
let hospitalsList = $state<Hospital[]>([]);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);
let meta = $state<MetaPagination | null>(null);

/**
 * GET /hospitals — Fetch all hospitals with search, status & pagination filters
 */
export async function fetchHospitals(params?: { search?: string; page?: number; limit?: number; is_active?: string }) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));
		if (params?.is_active !== undefined) query.set('is_active', params.is_active);

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<HospitalListResponse>(`/hospitals${queryString}`);

		if (response && Array.isArray(response.data)) {
			hospitalsList = response.data.map(normalizeHospital);
			if (response.meta) {
				meta = response.meta;
			}
		}
		return hospitalsList;
	} catch (err: any) {
		console.warn('GET /hospitals failed:', err?.message);
		error = err?.message || 'Gagal mengambil data rumah sakit dari server';
		return hospitalsList;
	} finally {
		isLoading = false;
	}
}

/**
 * GET /hospitals/:id — Fetch hospital detail by ID
 */
export async function getHospitalById(id: string): Promise<Hospital | null> {
	try {
		const response = await api.get<HospitalSingleResponse>(`/hospitals/${id}`);
		if (response && response.data) {
			return normalizeHospital(response.data);
		}
		return null;
	} catch (err: any) {
		console.error(`Gagal mengambil detail rumah sakit ID ${id}:`, err);
		return hospitalsList.find((h) => h.id === id) || null;
	}
}

/**
 * POST /hospitals — Create a new hospital
 */
export async function createHospital(payload: CreateHospitalPayload): Promise<Hospital> {
	isLoading = true;
	error = null;

	try {
		const response = await api.post<HospitalSingleResponse>('/hospitals', payload);
		if (response && response.data) {
			const newHospital = normalizeHospital(response.data);
			hospitalsList = [newHospital, ...hospitalsList];
			return newHospital;
		}
		throw new Error('Respon server tidak valid');
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal menambahkan rumah sakit';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

/**
 * PATCH /hospitals/:id — Update existing hospital detail
 */
export async function updateHospital(id: string, payload: UpdateHospitalPayload): Promise<Hospital> {
	isLoading = true;
	error = null;

	try {
		const response = await api.patch<HospitalSingleResponse>(`/hospitals/${id}`, payload);
		if (response && response.data) {
			const updated = normalizeHospital(response.data);
			hospitalsList = hospitalsList.map((h) => (h.id === id ? updated : h));
			return updated;
		}
		throw new Error('Respon server tidak valid');
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal memperbarui rumah sakit';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

/**
 * DELETE /hospitals/:id — Soft delete hospital by ID
 * Backend performs cascading soft-delete on associated departments & users
 */
export async function deleteHospital(id: string): Promise<boolean> {
	isLoading = true;
	error = null;

	try {
		const response = await api.delete<HospitalSingleResponse>(`/hospitals/${id}`);
		if (response && response.data) {
			const updated = normalizeHospital(response.data);
			hospitalsList = hospitalsList.map((h) => (h.id === id ? updated : h));
		} else {
			hospitalsList = hospitalsList.map((h) => (h.id === id ? { ...h, is_active: false } : h));
		}
		return true;
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal menonaktifkan rumah sakit';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

export const hospitalStore = {
	get list() { return hospitalsList; },
	get isLoading() { return isLoading; },
	get error() { return error; },
	get meta() { return meta; },
	fetchHospitals,
	getHospitalById,
	createHospital,
	updateHospital,
	deleteHospital
};
