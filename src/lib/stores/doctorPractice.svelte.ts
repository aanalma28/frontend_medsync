import { api } from '$lib/api/api';
import type {
	AppointmentStatus,
	VisitStatus,
	DoctorAssessment,
	NurseAssessment
} from '$lib/stores/patientAppointment.svelte';

const visitStatusLabels: Record<VisitStatus, string> = {
	REGISTERED: 'Menunggu Pemeriksaan Perawat',
	NURSE_CHECKED: 'Siap Diperiksa Dokter',
	DOCTOR_EXAMINED: 'Selesai Diperiksa Dokter',
	CANCELLED: 'Dibatalkan',
	COMPLETED: 'Kunjungan Selesai'
};

const visitStatusPriority: Record<VisitStatus, number> = {
	NURSE_CHECKED: 0,
	REGISTERED: 1,
	DOCTOR_EXAMINED: 2,
	CANCELLED: 3,
	COMPLETED: 4
};

export type RegisteredPatient = {
	/** Appointment ID used for UI selection and local record lookup. */
	id: string;
	/** Visit ID used by the doctor's status-update endpoint. */
	visitId: string | null;
	slotId?: string;
	patientId: string;
	patientName: string;
	age: number | null;
	gender: string;
	phone: string;
	queueNumber: number;
	timeSlot: string;
	appointmentStatus: AppointmentStatus | null;
	/** Visit status from appointment.visit_status, not appointment.status. */
	backendStatus: VisitStatus | null;
	status: string;
	complaint?: string;
	detail_sympton?: string;
	vitalSigns?: string;
	doctorAssessment?: DoctorAssessment | null;
	nurseAssessment?: NurseAssessment | null;
	isUrgent?: boolean;
};

export type DoctorAssesmentData = {
	subjective: string, 
	objective: string, 
	assesment: string, 
	plan: string, 
	notes: string
}

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
	date: string;
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
	visitId: string | null;
	patient_name: string;
	patient_age: number | null;
	gender: string;
	visitDate: string;
	sessionType: string;
	complaint: string;
	detail_sympton?: string;
	diagnosis: string;
	prescription: Array<{ name: string; rules_using: string }>;
	vitalSigns: string;
	doctorNotes: string;
	doctorAssessment?: DoctorAssessment | null;
	nurseAssessment?: NurseAssessment | null;
	appointmentStatus: AppointmentStatus | null;
	/** Visit status from appointment.visit_status, not appointment.status. */
	backendStatus: VisitStatus | null;
	status: string;
};

export type DoctorExaminedPatient = {
	patientId: string;
	name: string;
	age: number | null;
	gender: string;
	phone: string;
	address: string;
	totalVisits: number;
	lastVisitDate: string;
	primaryDiagnosis: string;
	histories: MedicalRecordEntry[];
};

let schedules = $state<DoctorSchedule[]>([]);
let todayPatients = $state<RegisteredPatient[]>([]);
let examinedPatients = $state<DoctorExaminedPatient[]>([]);
let isLoading = $state<boolean>(false);
let error = $state<string | null>(null);
const pendingVisitUpdates = new Set<string>();

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

	formatted = formatted.replace(
		/(\d{4})-(\d{2})-(\d{2})T[0-9:.Z]+/g,
		(_match, y, m, d) => `${d}/${m}/${y}`
	);

	return formatted || 'Terjadi kesalahan pada server';
}

export function calculateAge(birthDate?: string): number {
	if (!birthDate) return 30;
	const birth = new Date(birthDate);
	const age = new Date().getFullYear() - birth.getFullYear();
	return age > 0 ? age : 25;
}

function normalizeAppointmentStatus(status: unknown): AppointmentStatus | null {
	switch (status) {
		case 'PENDING':
		case 'CONFIRMED':
		case 'CANCELLED':
		case 'COMPLETED':
			return status;
		default:
			return null;
	}
}

function normalizeVisitStatus(status: unknown): VisitStatus | null {
	switch (status) {
		case 'REGISTERED':
		case 'NURSE_CHECKED':
		case 'DOCTOR_EXAMINED':
		case 'CANCELLED':
		case 'COMPLETED':
			return status;
		default:
			return null;
	}
}

function normalizeVisitId(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function mapVisitStatus(status: string | null | undefined): string {
	const normalized = normalizeVisitStatus(status);
	return normalized ? visitStatusLabels[normalized] : 'Status Kunjungan Tidak Diketahui';
}

/** Compatibility alias for callers that previously used this for visit labels. */
export const mapAppointmentStatus = mapVisitStatus;

export function canExaminePatient(
	patient: Pick<RegisteredPatient, 'backendStatus' | 'visitId'> | null | undefined
): boolean {
	return (
		normalizeVisitId(patient?.visitId) !== null &&
		patient?.backendStatus === 'NURSE_CHECKED'
	);
}

export function canCancelPatient(
	patient: Pick<RegisteredPatient, 'backendStatus' | 'visitId'> | null | undefined
): boolean {
	return (
		normalizeVisitId(patient?.visitId) !== null &&
		(patient?.backendStatus === 'REGISTERED' || patient?.backendStatus === 'NURSE_CHECKED')
	);
}

/**
 * Keep every patient, including cancelled/completed visits and unknown statuses.
 * Preserve the server's order within each status group.
 */
export function sortPatientsByVisitStatus(patients: RegisteredPatient[]): RegisteredPatient[] {
	return [...patients].sort((a, b) => {
		const aPriority = a.backendStatus === null ? 5 : visitStatusPriority[a.backendStatus];
		const bPriority = b.backendStatus === null ? 5 : visitStatusPriority[b.backendStatus];
		return aPriority - bPriority;
	});
}

function normalizeGender(gender: unknown): string {
	if (gender === 'LAKILAKI' || gender === 'Laki-laki') return 'Laki-laki';
	if (gender === 'PEREMPUAN' || gender === 'Perempuan') return 'Perempuan';
	return 'Belum tersedia';
}

function normalizeAge(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const age = Number(value);
	return Number.isFinite(age) && age >= 0 ? age : null;
}

function formatVitalSigns(assessment?: NurseAssessment | null): string {
	if (!assessment) return 'Data tanda vital belum tersedia.';
	return [
		`TD: ${assessment.sistolic ?? '-'}/${assessment.diastolic ?? '-'} mmHg`,
		`Nadi: ${assessment.heart_rate ?? '-'} bpm`,
		`RR: ${assessment.respiratory_rate ?? '-'}x/menit`,
		`Suhu: ${assessment.temperature ?? '-'}°C`,
		`BB: ${assessment.weight ?? '-'} kg`,
		`TB: ${assessment.height ?? '-'} cm`
	].join(' | ');
}

function normalizePatient(item: any, slot?: any): RegisteredPatient {
	const patient = item.patient || {};
	const appointment = item.appointment || item;
	const practiceSlot = slot || item.slot || {};
	const nurseAssessment = item.nurse_assesment ?? appointment.nurse_assesment ?? null;
	const doctorAssessment = item.doctor_assesment ?? appointment.doctor_assesment ?? null;
	const appointmentStatus = normalizeAppointmentStatus(appointment.status);
	const backendStatus = normalizeVisitStatus(appointment.visit_status);

	return {
		id: item.appointment_id || appointment.id,
		visitId: normalizeVisitId(appointment.visit_id),
		slotId: practiceSlot.id,
		patientId: patient.medical_record_number || patient.patient_code || patient.id || '',
		patientName: patient.patient_name || patient.name || 'Pasien',
		age: normalizeAge(patient.patient_age ?? patient.age),
		gender: normalizeGender(patient.gender),
		phone: patient.phone || 'Belum tersedia',
		queueNumber: appointment.queue_number ?? item.queue_number,
		timeSlot: practiceSlot.start_hour ? `${practiceSlot.start_hour} WIB` : 'Belum tersedia',
		appointmentStatus,
		backendStatus,
		status: mapVisitStatus(backendStatus),
		complaint: appointment.complaint ?? patient.complaint ?? '',
		detail_sympton: appointment.detail_sympton ?? patient.detail_sympton ?? '',
		vitalSigns: formatVitalSigns(nurseAssessment),
		doctorAssessment,
		nurseAssessment,
		isUrgent: item.isUrgent ?? false
	};
}

// ================= API FETCH START =================

/**
 * GET /doctor/practice/schedules
 */
export async function fetchSchedules(params?: {
	date_from?: string;
	date_to?: string;
	page?: number;
	limit?: number;
}) {
	isLoading = true;
	error = null;

	try {
		const query = new URLSearchParams();
		if (params?.date_from) query.set('date_from', params.date_from);
		if (params?.date_to) query.set('date_to', params.date_to);
		query.set('page', String(params?.page || 1));
		query.set('limit', String(params?.limit || 50));

		const response = await api.get<{ data: any[] }>(
			`/doctor/practice/schedules?${query.toString()}`
		);

		if (!Array.isArray(response?.data)) {
			throw new Error('Format data jadwal dari server tidak valid.');
		}

		schedules = response.data.map((practice: any) => {
			const date = practice.practice_date.split('T')[0];
			const dateObj = new Date(`${date}T00:00:00`);
			const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
			const dateDisplay = dateObj.toLocaleDateString('id-ID', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});

			const slots: PracticeSlot[] = (practice.slots || []).map((slot: any) => ({
				id: slot.id,
				name: slot.name,
				start_hour: slot.start_hour,
				end_hour: slot.end_hour,
				status_slot: slot.status_slot || 'OPEN',
				is_active: slot.is_active ?? true,
				max_patient: slot.max_patient,
				current_patient_count: slot.current_patient_count ?? 0
			}));

			const patients = (practice.slots || []).flatMap((slot: any) =>
				(slot.appointments || []).map((appointment: any) => normalizePatient(appointment, slot))
			);

			return {
				id: practice.id,
				date,
				dateDisplay,
				dayName,
				sessionName: slots[0]?.name || 'Jadwal Praktik',
				startTime: slots[0]?.start_hour || '',
				endTime: slots[0]?.end_hour || '',
				quota: slots[0]?.max_patient ?? 0,
				room: practice.room || 'Belum tersedia',
				slots,
				patients
			};
		});

		return schedules;
	} catch (err: any) {
		console.warn('GET /doctor/practice/schedules failed:', err);
		error = parseBackendError(err);
		return schedules;
	} finally {
		isLoading = false;
	}
}

/**
 * GET /doctor/practice/today-patients
 * Request all of today's patients without an appointment/visit status filter.
 */
export async function fetchTodayPatients() {
	try {
		const response = await api.get<{ data: { patients: any[] } }>(
			'/doctor/practice/today-patients'
		);

		if (!Array.isArray(response?.data?.patients)) {
			throw new Error('Format data pasien hari ini dari server tidak valid.');
		}

		todayPatients = response.data.patients.map((item: any) => normalizePatient(item));
		return sortPatientsByVisitStatus(todayPatients);
	} catch (err: any) {
		console.warn('GET /doctor/practice/today-patients failed:', err);
		error = parseBackendError(err);
		return sortPatientsByVisitStatus(todayPatients);
	}
}

/**
 * GET /doctor/practice/patient-history
 */
export async function fetchPatientHistory(search: string = '') {
	try {
		const query = new URLSearchParams();
		if (search.trim()) query.set('search', search.trim());
		query.set('page', '1');
		query.set('limit', '50');

		const response = await api.get<{ data: any[] }>(
			`/doctor/practice/patient-history?${query.toString()}`
		);

		if (!Array.isArray(response?.data)) {
			throw new Error('Format data riwayat pasien dari server tidak valid.');
		}

		const patientMap = new Map<string, DoctorExaminedPatient>();

		response.data.forEach((history: any) => {
			const patient = history.patient || {};
			const rm =
				patient.medical_record_number ||
				patient.patient_code ||
				patient.id ||
				history.patient_id ||
				history.id;
			const appointment = history.appointment || {};
			const doctorAssessment = history.doctor_assesment ?? appointment.doctor_assesment ?? null;
			const nurseAssessment = history.nurse_assesment ?? appointment.nurse_assesment ?? null;
			const appointmentStatus = normalizeAppointmentStatus(appointment.status);
			const backendStatus = normalizeVisitStatus(appointment.visit_status);
			const dateDisplay = history.createdAt
				? new Date(history.createdAt).toLocaleDateString('id-ID', {
						day: 'numeric',
						month: 'long',
						year: 'numeric'
					})
				: 'Tanggal belum tersedia';

			const entry: MedicalRecordEntry = {
				id: history.id,
				visitId: normalizeVisitId(appointment.visit_id),
				visitDate: `${dateDisplay} (${appointment.slot_name || 'Sesi Praktik'})`,
				sessionType: 'Konsultasi & Pemeriksaan Dokter',
				complaint: history.complaint ?? appointment.complaint ?? patient.complaint ?? '',
				detail_sympton:
					history.detail_sympton ?? appointment.detail_sympton ?? patient.detail_sympton ?? '',
				diagnosis: doctorAssessment?.assesment || history.diagnosis || 'Belum diisi.',
				patient_name: history.patient_name || patient.patient_name || patient.name || 'Pasien',
				patient_age: normalizeAge(history.patient_age ?? patient.patient_age ?? patient.age),
				gender: normalizeGender(history.gender ?? patient.gender),
				prescription: history.recipe?.detailRecipe || [],
				vitalSigns: formatVitalSigns(nurseAssessment),
				doctorNotes: doctorAssessment?.notes || doctorAssessment?.plan || history.notes || '',
				doctorAssessment,
				nurseAssessment,
				appointmentStatus,
				backendStatus,
				status: mapVisitStatus(backendStatus)
			};

			const existing = patientMap.get(rm);
			if (existing) {
				existing.histories.push(entry);
				existing.totalVisits += 1;
			} else {
				patientMap.set(rm, {
					patientId: rm,
					name: entry.patient_name,
					age: entry.patient_age,
					gender: entry.gender,
					phone: patient.phone || 'Belum tersedia',
					address: patient.address || 'Alamat belum tersedia',
					totalVisits: 1,
					lastVisitDate: dateDisplay,
					primaryDiagnosis: entry.diagnosis,
					histories: [entry]
				});
			}
		});

		examinedPatients = Array.from(patientMap.values());
		return examinedPatients;
	} catch (err: any) {
		console.warn('GET /doctor/practice/patient-history failed:', err);
		error = parseBackendError(err);
		return examinedPatients;
	}
}

/**
 * POST /doctor/practice
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
		const response = await api.post<{ statusCode: number; message: string; data: any }>(
			'/doctor/practice',
			payload
		);
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
 * PATCH /doctor/practice/slots/:id/toggle-active
 */
export async function toggleSlotActive(slotId: string, isActive: boolean) {
	try {
		const response = await api.patch<{ statusCode: number; message: string }>(
			`/doctor/practice/slots/${slotId}/toggle-active`,
			{ is_active: isActive }
		);
		await fetchSchedules();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	}
}

/**
 * PATCH /doctor/practice/slots/:id/status
 */
export async function updateSlotStatus(slotId: string, statusSlot: 'OPEN' | 'CLOSED') {
	try {
		const response = await api.patch<{ statusCode: number; message: string }>(
			`/doctor/practice/slots/${slotId}/status`,
			{ status_slot: statusSlot }
		);
		await fetchSchedules();
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	}
}

function findAppointment(appointmentId: string): RegisteredPatient | undefined {
	return (
		todayPatients.find((patient) => patient.id === appointmentId) ||
		schedules.flatMap((schedule) => schedule.patients).find((patient) => patient.id === appointmentId)
	);
}

/**
 * Update visit status through the existing endpoint:
 * PATCH /doctor/practice/appointments/:visitId/status
 *
 * The caller still supplies an appointment ID for local lookup. The HTTP request
 * uses only appointment.visit_id, never a fallback to the appointment ID.
 * The request field remains `status`; response visit state is `visit_status`.
 *
 * Allowed transitions, requiring a non-null visit ID:
 * - NURSE_CHECKED -> DOCTOR_EXAMINED
 * - REGISTERED / NURSE_CHECKED -> CANCELLED
 *
 * Calling/selecting a patient never changes either status.
 * The backend must also validate transitions against its current visit state.
 */
export async function updateAppointmentStatus(
	appointmentId: string,
	status: 'DOCTOR_EXAMINED' | 'CANCELLED'
) {
	if (status !== 'DOCTOR_EXAMINED' && status !== 'CANCELLED') {
		throw new Error('Dokter hanya dapat menyelesaikan pemeriksaan atau membatalkan kunjungan.');
	}

	const patient = findAppointment(appointmentId);
	if (!patient) {
		throw new Error('Data reservasi pasien tidak ditemukan. Silakan perbarui data.');
	}

	const visitId = normalizeVisitId(patient.visitId);
	if (!visitId) {
		throw new Error('ID kunjungan belum tersedia. Silakan perbarui data sebelum mengubah status.');
	}
	if (pendingVisitUpdates.has(visitId)) {
		throw new Error('Status kunjungan pasien sedang disimpan.');
	}
	if (status === 'DOCTOR_EXAMINED' && !canExaminePatient(patient)) {
		throw new Error('Hanya pasien yang sudah diperiksa perawat yang dapat diproses dokter.');
	}
	if (status === 'CANCELLED' && !canCancelPatient(patient)) {
		throw new Error('Hanya kunjungan berstatus REGISTERED atau NURSE_CHECKED yang dapat dibatalkan.');
	}

	pendingVisitUpdates.add(visitId);
	error = null;

	try {
		const response = await api.patch<{ statusCode: number; message: string }>(
			`/doctor/practice/visits/${encodeURIComponent(visitId)}/status`,
			{ status }
		);

		// Apply only the confirmed visit transition to the same appointment/visit.
		// Appointment status remains independent and is refreshed from the backend.
		const applyVisitStatus = (item: RegisteredPatient): RegisteredPatient =>
			item.id === appointmentId && item.visitId === visitId
				? { ...item, backendStatus: status, status: mapVisitStatus(status) }
				: item;

		todayPatients = todayPatients.map(applyVisitStatus);
		schedules = schedules.map((schedule) => ({
			...schedule,
			patients: schedule.patients.map(applyVisitStatus)
		}));

		await Promise.all([fetchSchedules(), fetchTodayPatients(), fetchPatientHistory()]);
		return response;
	} catch (err: any) {
		const parsed = parseBackendError(err);
		error = parsed;
		throw new Error(parsed);
	} finally {
		pendingVisitUpdates.delete(visitId);
	}
}

export async function createDoctorAssesment(
	visitId: string,
	assesmenData: DoctorAssesmentData,
){
	const visitIdNormalized = normalizeVisitId(visitId);
	if (!visitIdNormalized) {
		throw new Error('ID kunjungan belum tersedia. Silakan perbarui data sebelum mengubah status.');
	}

	const response = await api.post<{ statusCode: number; message: string }>(
		'/doctor/practice/examinations',
		{
			visitId: visitIdNormalized,
			subjective: assesmenData.subjective,
			objective: assesmenData.objective,
			assessment: assesmenData.assesment,
			plan: assesmenData.plan,
			doctorNotes: assesmenData.notes

		}
	)
}

// ================= API FETCH STOP =================

export const doctorPracticeStore = {
	get schedules(): DoctorSchedule[] {
		return schedules;
	},
	get sessionCards(): PracticeSessionCard[] {
		const cards: PracticeSessionCard[] = [];
		for (const schedule of schedules) {
			if (schedule.slots && schedule.slots.length > 0) {
				for (const slot of schedule.slots) {
					const count = slot.current_patient_count ?? 0;
					cards.push({
						id: `${schedule.id}_${slot.id}`,
						slotId: slot.id,
						practiceId: schedule.id,
						date: schedule.date,
						dateDisplay: schedule.dateDisplay,
						dayName: schedule.dayName,
						sessionName: slot.name,
						startTime: slot.start_hour,
						endTime: slot.end_hour,
						status_slot: slot.status_slot,
						is_active: slot.is_active,
						quota: slot.max_patient,
						current_patient_count: count,
						isFull: count >= slot.max_patient,
						room: schedule.room,
						patients: schedule.patients.filter((patient) => patient.slotId === slot.id)
					});
				}
			} else {
				const count = schedule.patients.length;
				cards.push({
					id: schedule.id,
					slotId: schedule.id,
					practiceId: schedule.id,
					date: schedule.date,
					dateDisplay: schedule.dateDisplay,
					dayName: schedule.dayName,
					sessionName: schedule.sessionName,
					startTime: schedule.startTime,
					endTime: schedule.endTime,
					status_slot: count >= schedule.quota ? 'CLOSED' : 'OPEN',
					is_active: true,
					quota: schedule.quota,
					current_patient_count: count,
					isFull: count >= schedule.quota,
					room: schedule.room,
					patients: schedule.patients
				});
			}
		}
		return cards;
	},
	get todayPatients(): RegisteredPatient[] {
		return sortPatientsByVisitStatus(todayPatients);
	},
	get examinedPatients(): DoctorExaminedPatient[] {
		return examinedPatients;
	},
	get isLoading(): boolean {
		return isLoading;
	},
	get error(): string | null {
		return error;
	},
	canExaminePatient,
	canCancelPatient,
	fetchSchedules,
	fetchTodayPatients,
	fetchPatientHistory,
	createPracticeSchedule,
	toggleSlotActive,
	updateSlotStatus,
	updateAppointmentStatus
};
