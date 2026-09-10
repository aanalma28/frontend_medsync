import { api } from '$lib/api/api';
import { parseBackendError } from '$lib/stores/patientAppointment.svelte';

export type PrescriptionMedicine = {
	id: string;
	product_id: string;
	name: string;
	unit?: string;
	category?: string;
	rules_using: string;
};

export type PatientPrescription = {
	id: string;
	no_trx: string;
	recipe_date_exec: string;
	status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
	is_ready: boolean;
	take_med_date?: string | null;
	verify_notes?: string | null;
	notes?: string | null;
	doctor: {
		id: string;
		name: string;
		department_name?: string;
	};
	pharmacist?: {
		id: string;
		name: string;
	} | null;
	medicines: PrescriptionMedicine[];
};

let prescriptions = $state<PatientPrescription[]>([]);
let activePrescriptions = $state<PatientPrescription[]>([]);
let historyPrescriptions = $state<PatientPrescription[]>([]);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);

function extractPrescriptions(response: any): PatientPrescription[] {
	if (Array.isArray(response)) return response;
	if (Array.isArray(response?.data)) return response.data;
	if (Array.isArray(response?.data?.prescriptions)) return response.data.prescriptions;
	if (Array.isArray(response?.data?.items)) return response.data.items;
	if (Array.isArray(response?.prescriptions)) return response.prescriptions;
	return [];
}

export async function fetchPrescriptions(params?: {
	status?: string;
	type?: 'active' | 'history';
}) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.status) query.set('status', params.status);
		if (params?.type) query.set('type', params.type);

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<{ data: PatientPrescription[] }>(
			`/patient/dashboard/prescriptions${queryString}`
		);

		const prescriptionItems = extractPrescriptions(response);
		if (response) {
			prescriptions = prescriptionItems;
			activePrescriptions = prescriptionItems.filter(
				(rx) => rx.status === 'PENDING' || rx.status === 'CONFIRMED'
			);
			historyPrescriptions = prescriptionItems.filter(
				(rx) => rx.status === 'COMPLETED' || rx.status === 'CANCELLED'
			);
		} else {
			prescriptions = [];
			activePrescriptions = [];
			historyPrescriptions = [];
		}
		return prescriptions;
	} catch (err: any) {
		console.warn('GET /patient/dashboard/prescriptions failed:', err);
		error = parseBackendError(err);
		return [];
	} finally {
		isLoading = false;
	}
}

export const patientPrescriptionStore = {
	get prescriptions() {
		return prescriptions;
	},
	get activePrescriptions() {
		return activePrescriptions;
	},
	get historyPrescriptions() {
		return historyPrescriptions;
	},
	get isLoading() {
		return isLoading;
	},
	get error() {
		return error;
	},
	fetchPrescriptions
};
