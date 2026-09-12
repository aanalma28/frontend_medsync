import { api } from '$lib/api/api';

export type ScheduleSlot = {
	id: string;
	name: string;
	start_hour: string;
	end_hour: string;
	status_slot: 'OPEN' | 'CLOSED';
	is_active: boolean;
	max_patient: number;
	current_patient_count: number;
	remaining_quota: number;
};

export type DoctorSchedule = {
	id: string;
	practice_date: string;
	doctor: {
		id: string;
		name: string;
		email?: string;
		phone?: string;
		staff_code?: string;
		department?: {
			id: string;
			name: string;
			departmen_code?: string;
			address?: string;
			city?: string;
		};
	};
	slots: ScheduleSlot[];
};

export type DoctorAssessment = {
	objective?: string | null;
	assesment?: string | null;
	plan?: string | null;
	notes?: string | null;
};

export type NurseAssessment = {
	sistolic?: number | null;
	diastolic?: number | null;
	heart_rate?: number | null;
	respiratory_rate?: number | null;
	temperature?: number | null;
	weight?: number | null;
	height?: number | null;
};

export type PatientAppointment = {			
	appointment?: {
		id: string;
		queue_number: number;
		status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
		createdAt: string;
		updatedAt?: string;
		complaint?: string | null;
		detail_sympton?: string | null;
		doctor_assesment?: DoctorAssessment | null;
		nurse_assesment?: NurseAssessment | null;

	};
	slot?: {
		id: string;
		name: string;
		start_hour: string;
		end_hour: string;
	};
	practice_date?: string;
	doctor?: {
		id: string;
		name: string;
		staff_code?: string;
		department?: {
			id: string;
			name: string;
			departmen_code?: string;
			address?: string;
			city?: string;
		};
	};
	patient?: {
		patient_code: string;
		name: string;
		gender?: string;
		age: number;
	}
};

export type AppoinmentInputs = {
	patient_id: string,
	complaint: string,
	detail_sympton: string,
}

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

function extractList<T>(response: unknown, keys: string[]): T[] {
	if (!response || typeof response !== 'object') return [];
	const payload = response as Record<string, unknown>;
	const data = payload.data;
	if (Array.isArray(response)) return response;
	if (Array.isArray(data)) return data as T[];
	for (const key of keys) {
		if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>)[key])) {
			return (data as Record<string, unknown>)[key] as T[];
		}
		if (Array.isArray(payload[key])) return payload[key] as T[];
	}
	return [];
}

let schedules = $state<DoctorSchedule[]>([]);
let appointments = $state<PatientAppointment[]>([]);
let isLoadingSchedules = $state<boolean>(false);
let isLoadingAppointments = $state<boolean>(false);
let isSubmitting = $state<boolean>(false);
let error = $state<string | null>(null);
let schedulesMeta = $state<any>(null);
let appointmentsMeta = $state<any>(null);

export async function fetchSchedules(params?: {
	date?: string;
	departmen_id?: string;
	date_from?: string;
	date_to?: string;
	search?: string;
	page?: number;
	limit?: number;
}) {
	isLoadingSchedules = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.date) query.set('date', params.date);
		if (params?.departmen_id) query.set('departmen_id', params.departmen_id);
		if (params?.date_from) query.set('date_from', params.date_from);
		if (params?.date_to) query.set('date_to', params.date_to);
		if (params?.search) query.set('search', params.search);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit || 20));

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<{ data: DoctorSchedule[]; meta?: any }>(
			`/patient/dashboard/schedules${queryString}`
		);

		const scheduleItems = extractList<DoctorSchedule>(response, ['schedules', 'items', 'results']);
		if (scheduleItems.length > 0 || response) {
			schedules = scheduleItems;
			schedulesMeta = response?.meta || null;
		} else {
			schedules = [];
		}
		return schedules;
	} catch (err: any) {
		console.warn('GET /patient/dashboard/schedules failed:', err);
		error = parseBackendError(err);
		return [];
	} finally {
		isLoadingSchedules = false;
	}
}

export async function fetchAppointments(params?: {
	status?: string;
	page?: number;
	limit?: number;
}) {
	isLoadingAppointments = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.status && params.status !== 'ALL') query.set('status', params.status);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit || 50));

		const queryString = query.toString() ? `?${query.toString()}` : '';
		const response = await api.get<{ data: PatientAppointment[]; meta?: any }>(
			`/patient/dashboard/appointments${queryString}`
		);

		console.log(response.data)

		const appointmentItems = extractList<PatientAppointment>(response, ['appointments', 'items', 'results']);
		if (appointmentItems.length > 0 || response) {
			appointments = appointmentItems.map((item) =>
				item.appointment ? { ...item, ...item.appointment } : item
			);
			appointmentsMeta = response?.meta || null;
		} else {
			appointments = [];
		}
		return appointments;
	} catch (err: any) {
		console.warn('GET /patient/dashboard/appointments failed:', err);
		error = parseBackendError(err);
		return [];
	} finally {
		isLoadingAppointments = false;
	}
}

export async function createAppointment(slotPracticeId: string, appoinmentInputs: AppoinmentInputs) {
	isSubmitting = true;
	error = null;
	console.log(appoinmentInputs)

	try {
		const response = await api.post<{ statusCode: number; message: string; data: any }>(
			'/patient/dashboard/appointments',
			{
				slot_practice_id: slotPracticeId,
				patient_id: appoinmentInputs.patient_id,
				complaint: appoinmentInputs.complaint,
				detail_sympton: appoinmentInputs.detail_sympton,
			}
		);

		await Promise.all([fetchAppointments(), fetchSchedules()]);
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		console.log(parsed)
		error = parsed;
		throw new Error(parsed);
	} finally {
		isSubmitting = false;
	}
}

export async function cancelAppointment(appointmentId: string) {
	isSubmitting = true;
	error = null;

	try {
		const response = await api.patch<{ statusCode: number; message: string; data: any }>(
			`/patient/dashboard/appointments/${appointmentId}/cancel`
		);

		await Promise.all([fetchAppointments(), fetchSchedules()]);
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		isSubmitting = false;
	}
}

export const patientAppointmentStore = {
	get schedules() {
		return schedules;
	},
	get appointments() {
		return appointments;
	},
	get isLoadingSchedules() {
		return isLoadingSchedules;
	},
	get isLoadingAppointments() {
		return isLoadingAppointments;
	},
	get isSubmitting() {
		return isSubmitting;
	},
	get error() {
		return error;
	},
	get schedulesMeta() {
		return schedulesMeta;
	},
	get appointmentsMeta() {
		return appointmentsMeta;
	},
	fetchSchedules,
	fetchAppointments,
	createAppointment,
	cancelAppointment
};
