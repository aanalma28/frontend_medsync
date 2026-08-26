import { api } from '$lib/api/api';

export interface UserItem {
	id: string;
	name: string;
	email: string;
	role: string;
	phone?: string;
	address?: string;
	birth_date?: string;
	is_active: boolean;
	accepted_terms?: boolean;
	createdAt?: string;
	updatedAt?: string;
	patientUser?: {
		id: string;
		medical_record_number: string;
	} | null;
	employeeUser?: {
		id: string;
		staff_code: string;
		departmen_id: string;
		departmen?: {
			id: string;
			name: string;
			departmen_code: string;
			address?: string;
			city?: string;
		} | null;
	} | null;
	// UI derived / display fields
	displayId?: string;
	branch?: string;
	status?: string;
}

export interface MetaPagination {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface UserListResponse {
	statusCode: number;
	message: string;
	data: UserItem[];
	meta?: MetaPagination;
}

export interface UserSingleResponse {
	statusCode: number;
	message: string;
	data: UserItem;
}

export interface CreatePatientPayload {
	name: string;
	email: string;
	password: string;
	phone: string;
	address: string;
	birth_date: string;
	accepted_terms?: boolean;
}

export interface CreateStaffPayload {
	name: string;
	email: string;
	password: string;
	role: 'SUPERADMIN' | 'MASTERADMIN' | 'REGISTER_ADMIN' | 'DOCTOR' | 'PHARMACIST' | 'NURSE';
	departmen_id: string;
	phone: string;
	address?: string;
	birth_date: string;
}

export interface UpdateUserPayload {
	name?: string;
	email?: string;
	password?: string;
	role?: string;
	departmen_id?: string;
	phone?: string;
	address?: string;
	birth_date?: string;
	is_active?: boolean;
}

function normalizeUserRole(role: string): string {
	if (!role) return 'pasien';
	const r = role.toUpperCase();
	if (r === 'SUPERADMIN') return 'superadmin';
	if (r === 'MASTERADMIN' || r === 'REGISTER_ADMIN' || r === 'ADMIN') return 'admin';
	if (r === 'DOCTOR') return 'dokter';
	if (r === 'PHARMACIST') return 'apoteker';
	if (r === 'NURSE') return 'perawat';
	if (r === 'PATIENT') return 'pasien';
	return role.toLowerCase();
}

function normalizeUser(item: any): UserItem {
	const role = item.role || 'PATIENT';
	const normalizedRole = normalizeUserRole(role);

	let displayId = item.id;
	if (item.employeeUser?.staff_code) {
		displayId = item.employeeUser.staff_code;
	} else if (item.patientUser?.medical_record_number) {
		displayId = item.patientUser.medical_record_number;
	}

	let branch = '-';
	if (item.employeeUser?.departmen?.name) {
		branch = item.employeeUser.departmen.name;
	} else if (normalizedRole === 'superadmin') {
		branch = 'Pusat';
	}

	const status = item.is_active ? 'Aktif' : 'Non-Aktif';

	return {
		...item,
		role: normalizedRole,
		displayId,
		branch,
		status
	};
}

// Reactive state (Svelte 5 runes)
let usersList = $state<UserItem[]>([]);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);
let meta = $state<MetaPagination | null>(null);

/**
 * GET /users — Fetch all users with optional query params
 */
export async function fetchUsers(params?: { search?: string; role?: string; is_active?: boolean; page?: number; limit?: number }) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.search) query.set('search', params.search);
		if (params?.role && params.role !== 'semua') {
			let dbRole = params.role.toUpperCase();
			if (params.role === 'admin') dbRole = 'REGISTER_ADMIN';
			else if (params.role === 'dokter') dbRole = 'DOCTOR';
			else if (params.role === 'apoteker') dbRole = 'PHARMACIST';
			else if (params.role === 'pasien') dbRole = 'PATIENT';
			query.set('role', dbRole);
		}
		if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<UserListResponse>(`/users${queryString}`);

		if (response && Array.isArray(response.data)) {
			usersList = response.data.map(normalizeUser);
			if (response.meta) {
				meta = response.meta;
			}
		}
		return usersList;
	} catch (err: any) {
		console.warn('GET /users failed:', err?.message);
		error = err?.message || 'Gagal mengambil data user dari server';
		return usersList;
	} finally {
		isLoading = false;
	}
}

/**
 * GET /users/:id — Fetch single user profile by ID
 */
export async function getUserById(id: string): Promise<UserItem | null> {
	try {
		const response = await api.get<UserSingleResponse>(`/users/${id}`);
		if (response && response.data) {
			return normalizeUser(response.data);
		}
		return null;
	} catch (err: any) {
		console.error(`Gagal mengambil detail user ID ${id}:`, err);
		return usersList.find((u) => u.id === id) || null;
	}
}

/**
 * POST /users/patient — Create a patient account
 */
export async function createPatient(payload: CreatePatientPayload): Promise<UserItem> {
	isLoading = true;
	error = null;

	try {
		const response = await api.post<UserSingleResponse>('/users/patient', payload);
		if (response && response.data) {
			const newUser = normalizeUser(response.data);
			usersList = [newUser, ...usersList];
			return newUser;
		}
		throw new Error('Respon server tidak valid');
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal membuat akun pasien';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

/**
 * POST /users/staff — Create a staff account
 */
export async function createStaff(payload: CreateStaffPayload): Promise<UserItem> {
	isLoading = true;
	error = null;

	try {
		const response = await api.post<UserSingleResponse>('/users/staff', payload);
		if (response && response.data) {
			const newUser = normalizeUser(response.data);
			usersList = [newUser, ...usersList];
			return newUser;
		}
		throw new Error('Respon server tidak valid');
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal membuat akun staff';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

/**
 * PATCH /users/:id — Update target user
 */
export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserItem> {
	isLoading = true;
	error = null;

	try {
		const response = await api.patch<UserSingleResponse>(`/users/${id}`, payload);
		if (response && response.data) {
			const updated = normalizeUser(response.data);
			usersList = usersList.map((u) => (u.id === id ? updated : u));
			return updated;
		}
		throw new Error('Respon server tidak valid');
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal memperbarui user';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

/**
 * DELETE /users/:id — Deactivate user account
 */
export async function deleteUser(id: string): Promise<boolean> {
	isLoading = true;
	error = null;

	try {
		await api.delete(`/users/${id}`);
		usersList = usersList.map((u) => (u.id === id ? { ...u, is_active: false, status: 'Non-Aktif' } : u));
		return true;
	} catch (err: any) {
		const msg = err?.response?.message || err?.message || 'Gagal menonaktifkan user';
		const formattedMsg = Array.isArray(msg) ? msg.join(' • ') : msg;
		error = formattedMsg;
		throw new Error(formattedMsg);
	} finally {
		isLoading = false;
	}
}

export const userStore = {
	get list() { return usersList; },
	get isLoading() { return isLoading; },
	get error() { return error; },
	get meta() { return meta; },
	fetchUsers,
	getUserById,
	createPatient,
	createStaff,
	updateUser,
	deleteUser
};
