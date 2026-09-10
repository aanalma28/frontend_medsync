import { api } from '$lib/api/api';

export type PatientFamilyMember = {
	id: string;
	name: string;
	gender: string;
	age: number;
	medicine_allergy: string;
};

export type PatientFamilyPayload = {
	name: string;
	gender: string;
	age: number;
	medicine_allergy?: string;
};

type FamilyResponse = {
	statusCode?: number;
	message?: string;
	data?: PatientFamilyMember[] | PatientFamilyMember;
};

const endpoint = '/users/family/patients';

function normalizeMember(item: any): PatientFamilyMember {
	return {
		id: String(item.id || item.patient_id || item.id_pasien || ''),
		name: item.name || item.nama || item.patient_name || '',
		gender: item.gender || item.jenis_kelamin || '',
		age: Number(item.age ?? item.umur ?? item.patient_age ?? 0),
		medicine_allergy: item.alergi_obat || item.drug_allergy || ''
	};
}

function getErrorMessage(err: any): string {
	const message = err?.response?.message || err?.message || 'Gagal memproses data anggota keluarga';
	return Array.isArray(message) ? message.join(', ') : String(message);
}

function extractMembers(response: FamilyResponse): PatientFamilyMember[] {
	const data = response?.data as any;
	if (Array.isArray(data)) return data.map(normalizeMember);
	if (Array.isArray(data?.members)) return data.members.map(normalizeMember);
	if (Array.isArray(data?.patients)) return data.patients.map(normalizeMember);
	return [];
}

let members = $state<PatientFamilyMember[]>([]);
let isLoading = $state(false);
let isSubmitting = $state(false);
let error = $state<string | null>(null);

export async function fetchFamilyMembers() {
	isLoading = true;
	error = null;
	try {
		const response = await api.get<FamilyResponse>(endpoint);
		members = extractMembers(response);
		return members;
	} catch (err: any) {
		error = getErrorMessage(err);
		return members;
	} finally {
		isLoading = false;
	}
}

export async function createFamilyMember(payload: PatientFamilyPayload) {
	isSubmitting = true;
	error = null;
	try {
		const response = await api.post<FamilyResponse>(endpoint, payload);
		const created = response?.data && !Array.isArray(response.data) ? normalizeMember(response.data) : null;
		if (!created) throw new Error('Respon server tidak valid');
		members = [...members, created];
		return created;
	} catch (err: any) {
		error = getErrorMessage(err);
		throw new Error(error);
	} finally {
		isSubmitting = false;
	}
}

export async function updateFamilyMember(id: string, payload: Partial<PatientFamilyPayload>) {
	isSubmitting = true;
	error = null;
	try {
		const response = await api.patch<FamilyResponse>(`${endpoint}/${id}`, payload);
		const updated = response?.data && !Array.isArray(response.data) ? normalizeMember(response.data) : null;
		if (updated) {
			members = members.map((member) => (member.id === id ? updated : member));
		} else {
			await fetchFamilyMembers();
		}
		return updated;
	} catch (err: any) {
		error = getErrorMessage(err);
		throw new Error(error);
	} finally {
		isSubmitting = false;
	}
}

export async function deleteFamilyMember(id: string) {
	isSubmitting = true;
	error = null;
	try {
		await api.delete(`${endpoint}/${id}`);
		members = members.filter((member) => member.id !== id);
	} catch (err: any) {
		error = getErrorMessage(err);
		throw new Error(error);
	} finally {
		isSubmitting = false;
	}
}

export const patientFamilyStore = {
	get members() {
		return members;
	},
	get isLoading() {
		return isLoading;
	},
	get isSubmitting() {
		return isSubmitting;
	},
	get error() {
		return error;
	},
	fetchFamilyMembers,
	createFamilyMember,
	updateFamilyMember,
	deleteFamilyMember
};
