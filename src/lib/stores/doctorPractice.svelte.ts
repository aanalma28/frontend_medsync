import { api } from '$lib/api/api';

export type RegisteredPatient = {
	id: string; // appointment_id
	patientId: string; // No. RM
	patientName: string;
	age: number;
	gender: 'Laki-laki' | 'Perempuan';
	phone: string;
	queueNumber: number;
	timeSlot: string;
	status: 'Sedang Diperiksa' | 'Menunggu' | 'Selesai' | 'Dibatalkan';
	complaint?: string;
	detail_sympton?: string;
	vitalSigns?: string;
	isUrgent?: boolean;
};

export type PracticeSlot = {
	id: string;
	name: string;
	start_hour: string;
	end_hour: string;
	status_slot: 'OPEN' | 'CLOSED';
	is_active: boolean;
	max_patient: number;
	current_patient_count: number;
};

export type DoctorSchedule = {
	id: string;
	date: string; // YYYY-MM-DD
	dateDisplay: string;
	dayName: string;
	sessionName: string;
	startTime: string;
	endTime: string;
	quota: number;
	room: string;
	slots?: PracticeSlot[];
	patients: RegisteredPatient[];
};

export type PracticeSessionCard = {
	id: string;
	slotId: string;
	practiceId: string;
	date: string;
	dateDisplay: string;
	dayName: string;
	sessionName: string;
	startTime: string;
	endTime: string;
	status_slot: 'OPEN' | 'CLOSED';
	is_active: boolean;
	quota: number;
	current_patient_count: number;
	isFull: boolean;
	room: string;
	patients: RegisteredPatient[];
};

export type MedicalRecordEntry = {
	id: string;
	patient_name: string;
	patient_age: number;
	gender: string;
	visitDate: string;
	sessionType: string;
	complaint: string;
	diagnosis: string;
	prescription: Array<{ name: string; rules_using: string }>;
	vitalSigns: string;
	doctorNotes: string;
	status: 'Selesai' | 'Rawat Jalan' | 'Rujukan' | 'Kontrol Ulang';
};

export type DoctorExaminedPatient = {
	patientId: string; // No. RM e.g. "RM-099"
	name: string;
	age: number;
	gender: 'Laki-laki' | 'Perempuan';
	phone: string;
	address: string;
	totalVisits: number;
	lastVisitDate: string;
	primaryDiagnosis: string;
	histories: MedicalRecordEntry[];
};

// ─── Reactive Store State (Svelte 5 Runes) ─────────────────────────────────
let schedules = $state<DoctorSchedule[]>([]);
let todayPatients = $state<RegisteredPatient[]>([]);
let examinedPatients = $state<DoctorExaminedPatient[]>([]);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);

// ─── Helper Functions ────────────────────────────────────────────────────────
export function parseBackendError(err: any): string {
	if (!err) return 'Terjadi kesalahan yang tidak diketahui';

	const rawMessage = err?.response?.message || err?.message || err;
	let formatted = '';

	if (Array.isArray(rawMessage)) {
		const cleanedItems = rawMessage.map((item: any) => {
			if (typeof item === 'string') {
				return item.replace(/^slots\.\d+\./, '').replace(/^slots\[\d+\]\./, '');
			}
			return typeof item === 'object' ? JSON.stringify(item) : String(item);
		});
		const uniqueItems = Array.from(new Set(cleanedItems));
		formatted = uniqueItems.join('\n• ');
		if (uniqueItems.length > 1) {
			formatted = '• ' + formatted;
		}
	} else if (typeof rawMessage === 'object' && rawMessage !== null) {
		formatted = rawMessage.message ? String(rawMessage.message) : JSON.stringify(rawMessage);
	} else {
		formatted = String(rawMessage);
	}

	formatted = formatted.replace(/(\d{4})-(\d{2})-(\d{2})T[0-9:.Z]+/g, (_match, y, m, d) => `${d}/${m}/${y}`);

	return formatted || 'Terjadi kesalahan pada server';
}

export function calculateAge(birthDate?: string): number {
	if (!birthDate) return 30;
	const birth = new Date(birthDate);
	const age = new Date().getFullYear() - birth.getFullYear();
	return age > 0 ? age : 25;
}

export function mapAppointmentStatus(status: string): 'Sedang Diperiksa' | 'Menunggu' | 'Selesai' | 'Dibatalkan' {
	switch (status) {
		case 'CONFIRMED':
			return 'Sedang Diperiksa';
		case 'COMPLETED':
			return 'Selesai';
		case 'CANCELLED':
			return 'Dibatalkan';
		case 'PENDING':
		default:
			return 'Menunggu';
	}
}

// ─── API Integration Actions ──────────────────────────────────────────────────

/**
 * GET /doctor/practice/schedules — Fetch practice schedules with slots & appointments
 */
export async function fetchSchedules(params?: { date_from?: string; date_to?: string; page?: number; limit?: number }) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.date_from) query.set('date_from', params.date_from);
		if (params?.date_to) query.set('date_to', params.date_to);
		query.set('page', String(params?.page || 1));
		query.set('limit', String(params?.limit || 50));

		const response = await api.get<{ data: any[] }>(`/doctor/practice/schedules?${query.toString()}`);

		if (response && Array.isArray(response.data)) {
			schedules = response.data.map((practice: any) => {
				const dateObj = new Date(practice.practice_date);
				const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
				const dayName = dayNames[dateObj.getDay()] || 'Hari';
				const dateDisplay = `${dayName}, ${dateObj.getDate()} Agt ${dateObj.getFullYear()}`;

				const slots: PracticeSlot[] = (practice.slots || []).map((s: any) => ({
					id: s.id,
					name: s.name,
					start_hour: s.start_hour,
					end_hour: s.end_hour,
					status_slot: s.status_slot || 'OPEN',
					is_active: s.is_active ?? true,
					max_patient: s.max_patient,
					current_patient_count: s.current_patient_count || 0
				}));

				const mappedPatients: RegisteredPatient[] = (practice.slots || []).flatMap((slot: any) =>
					(slot.appointments || []).map((apt: any) => ({
						id: apt.id,
						patientId: apt.patient?.medical_record_number || 'RM-000',
						patientName: apt.patient?.patient_name || 'Pasien',
						age: apt.patient?.patient_age || 99,
						gender: apt.patient?.gender || 'Perempuan',
						phone: apt.patient?.phone || '0812-0000-0000',
						queueNumber: apt.queue_number,
						timeSlot: `${slot.start_hour} WIB`,
						status: mapAppointmentStatus(apt.status),
						complaint: apt.patient.complaint,
						detailedSymptoms: apt.patient?.detail_sympton || 'Terdaftar melalui pendaftaran online MedSync.',
					}))
				);

				return {
					id: practice.id,
					date: practice.practice_date.split('T')[0],
					dateDisplay,
					dayName,
					sessionName: slots[0]?.name || 'Jadwal Praktik',
					startTime: slots[0]?.start_hour || '08:00',
					endTime: slots[0]?.end_hour || '12:00',
					quota: slots[0]?.max_patient || 10,
					room: 'Poli Utama - Ruang 102',
					slots,
					patients: mappedPatients
				};
			});
		}
		return schedules;
	} catch (err: any) {
		console.warn('GET /doctor/practice/schedules failed:', err);
		error = err?.message || 'Gagal mengambil data jadwal dari server';
		return schedules;
	} finally {
		isLoading = false;
	}
}

/**
 * GET /doctor/practice/today-patients — Fetch patients registered today
 */
export async function fetchTodayPatients() {
	try {
		const response = await api.get<{ data: { patients: any[] } }>('/doctor/practice/today-patients');
		if (response && response.data && Array.isArray(response.data.patients)) {
			todayPatients = response.data.patients.map((item: any) => ({
				id: item.appointment_id,
				patientId: item.patient?.medical_record_number || 'RM-000',
				patientName: item.patient?.patient_name || 'Pasien Hari Ini',
				age: item.patient?.patient_age || '99',
				gender: item.patient?.gender == "LAKILAKI" ? 'Laki-laki' : 'Perempuan',
				phone: item.patient?.phone || '0812-0000-0000',
				queueNumber: item.queue_number,
				timeSlot: `${item.slot?.start_hour || '08:00'} WIB`,
				status: mapAppointmentStatus(item.status),
				complaint: item.patient?.complaint || 'Pemeriksaan Kesehatan Poli',
				detail_sympton: item.patient?.detail_sympton || 'Pasien datang sesuai nomor antrean.',
			}));
		}
		return todayPatients;
	} catch (err: any) {
		console.warn('GET /doctor/practice/today-patients failed:', err);
		return todayPatients;
	}
}

/**
 * GET /doctor/practice/patient-history — Fetch medical history of patients handled by this doctor
 */
export async function fetchPatientHistory(search: string = '') {
	try {
		const query = new URLSearchParams();
		if (search.trim()) query.set('search', search.trim());
		query.set('page', '1');
		query.set('limit', '50');

		const response = await api.get<{ data: any[] }>(`/doctor/practice/patient-history?${query.toString()}`);

		if (response && Array.isArray(response.data)) {
			const patientMap = new Map<string, DoctorExaminedPatient>();

			response.data.forEach((mh: any) => {
				console.log(mh)
				const rm = mh.patient?.medical_record_number || 'RM-000';
				const dateDisplay = mh.createdAt
					? new Date(mh.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
					: 'Hari Ini';

				const entry: MedicalRecordEntry = {
					id: mh.id,
					visitDate: `${dateDisplay} (${mh.appointment?.slot_name || 'Sesi Praktik'})`,
					sessionType: 'Konsultasi & Pemeriksaan Dokter',
					complaint: mh.complaint || 'Keluhan Pasien',
					diagnosis: mh.diagnosis || 'Diagnosis Dokter',
					patient_name: mh.patient_name,
					patient_age: mh.patient_age,
					gender: mh.gender,
					prescription: mh.recipe?.detailRecipe || [],
					vitalSigns: 'TD: 120/80 mmHg | Suhu: 36.8°C',
					doctorNotes: mh.notes || 'Catatan pemeriksaan dokter.',
					status: mh.appointment?.status === 'COMPLETED' ? 'Selesai' : 'Rawat Jalan'
				};

				if (patientMap.has(rm)) {
					const existing = patientMap.get(rm)!;
					existing.histories.push(entry);
					existing.totalVisits += 1;
				} else {
					patientMap.set(rm, {
						patientId: rm,
						name: mh.patient?.name || 'Pasien',
						age: calculateAge(mh.patient?.birth_date),
						gender: 'Perempuan',
						phone: mh.patient?.phone || '0812-0000-0000',
						address: 'Alamat Pasien RS MedSync',
						totalVisits: 1,
						lastVisitDate: dateDisplay,
						primaryDiagnosis: mh.diagnosis || 'Diagnosa Medis',
						histories: [entry]
					});
				}
			});

			examinedPatients = Array.from(patientMap.values());
		}
		return examinedPatients;
	} catch (err: any) {
		console.warn('GET /doctor/practice/patient-history failed:', err);
		return examinedPatients;
	}
}

/**
 * POST /doctor/practice — Create a new practice schedule with slots
 */
export async function createPracticeSchedule(payload: {
	practice_date: string;
	slots: Array<{
		name: string;
		start_hour: string;
		end_hour: string;
		status_slot?: 'OPEN' | 'CLOSED';
		is_active?: boolean;
		max_patient: number;
	}>;
}) {
	isLoading = true;
	error = null;

	try {
		const response = await api.post<{ statusCode: number; message: string; data: any }>('/doctor/practice', payload);
		await fetchSchedules();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		isLoading = false;
	}
}

/**
 * PATCH /doctor/practice/slots/:id/toggle-active — Soft-delete / toggle slot active
 */
export async function toggleSlotActive(slotId: string, isActive: boolean) {
	try {
		const response = await api.patch<{ statusCode: number; message: string }>(`/doctor/practice/slots/${slotId}/toggle-active`, {
			is_active: isActive
		});
		await fetchSchedules();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	}
}

/**
 * PATCH /doctor/practice/slots/:id/status — Update slot status (OPEN/CLOSED)
 */
export async function updateSlotStatus(slotId: string, statusSlot: 'OPEN' | 'CLOSED') {
	try {
		const response = await api.patch<{ statusCode: number; message: string }>(`/doctor/practice/slots/${slotId}/status`, {
			status_slot: statusSlot
		});
		await fetchSchedules();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	}
}

/**
 * PATCH /doctor/practice/appointments/:id/status — Update appointment status
 */
export async function updateAppointmentStatus(appointmentId: string, status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED') {
	try {
		const response = await api.patch<{ statusCode: number; message: string }>(`/doctor/practice/appointments/${appointmentId}/status`, {
			status
		});
		await Promise.all([fetchSchedules(), fetchTodayPatients()]);
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	}
}

// ─── Exported Doctor Practice Svelte Store ─────────────────────────────────
export const doctorPracticeStore = {
	get schedules(): DoctorSchedule[] { return schedules; },
	get sessionCards(): PracticeSessionCard[] {
		const cards: PracticeSessionCard[] = [];
		for (const sched of schedules) {
			if (sched.slots && sched.slots.length > 0) {
				for (const slot of sched.slots) {
					const count = slot.current_patient_count || 0;
					const isFull = count >= slot.max_patient;
					const effectiveStatus = isFull ? 'CLOSED' : slot.status_slot;

					const slotPatients = sched.patients.filter((p) =>
						p.timeSlot.includes(slot.start_hour) || p.timeSlot.includes(slot.name)
					);

					cards.push({
						id: `${sched.id}_${slot.id}`,
						slotId: slot.id,
						practiceId: sched.id,
						date: sched.date,
						dateDisplay: sched.dateDisplay,
						dayName: sched.dayName,
						sessionName: slot.name,
						startTime: slot.start_hour,
						endTime: slot.end_hour,
						status_slot: effectiveStatus,
						is_active: slot.is_active,
						quota: slot.max_patient,
						current_patient_count: count,
						isFull,
						room: sched.room,
						patients: slotPatients.length > 0 ? slotPatients : sched.patients
					});
				}
			} else {
				const count = sched.patients.length;
				const isFull = count >= sched.quota;
				cards.push({
					id: sched.id,
					slotId: sched.id,
					practiceId: sched.id,
					date: sched.date,
					dateDisplay: sched.dateDisplay,
					dayName: sched.dayName,
					sessionName: sched.sessionName,
					startTime: sched.startTime,
					endTime: sched.endTime,
					status_slot: isFull ? 'CLOSED' : 'OPEN',
					is_active: true,
					quota: sched.quota,
					current_patient_count: count,
					isFull,
					room: sched.room,
					patients: sched.patients
				});
			}
		}
		return cards;
	},
	get todayPatients(): RegisteredPatient[] { return todayPatients; },
	get examinedPatients(): DoctorExaminedPatient[] { return examinedPatients; },
	get isLoading(): boolean { return isLoading; },
	get error(): string | null { return error; },
	fetchSchedules,
	fetchTodayPatients,
	fetchPatientHistory,
	createPracticeSchedule,
	toggleSlotActive,
	updateSlotStatus,
	updateAppointmentStatus
};
