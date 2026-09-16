import { api } from '$lib/api/api';

export type VisitStatus =
	| 'REGISTERED'
	| 'NURSE_CHECKED'
	| 'DOCTOR_EXAMINED'
	| 'CANCELLED'
	| 'COMPLETED';

export interface HistoryPatient {
	id: string;
	medicalRecordNumber: string;
	name: string;
	gender: string;
	age: number | null;
}

export interface NursingAssessment {
	systolic: number | null;
	diastolic: number | null;
	temperature: number | null;
	heartRate: number | null;
	weight: number | null;
	height: number | null;
	notes: string | null;
}

export interface PatientHistoryVisit {
	visitId: string;
	date: string;
	complaint: string | null;
	status: VisitStatus;
	patient: HistoryPatient;
	nursingAssessment: NursingAssessment | null;
}

const statuses: VisitStatus[] = [
	'REGISTERED',
	'NURSE_CHECKED',
	'DOCTOR_EXAMINED',
	'CANCELLED',
	'COMPLETED'
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new Error(`Format respons riwayat tidak valid: ${field} harus berupa string.`);
	}
	return value;
}

function nullableString(value: unknown, field: string): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') {
		throw new Error(`Format respons riwayat tidak valid: ${field} harus berupa string.`);
	}
	return value;
}

function nullableNumber(value: unknown, field: string): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Format respons riwayat tidak valid: ${field} harus berupa angka.`);
	}
	return value;
}

function parseAssessment(value: unknown): NursingAssessment | null {
	if (value === null || value === undefined) return null;
	if (!isRecord(value)) {
		throw new Error('Format respons nursingAssessment tidak valid.');
	}

	return {
		systolic: nullableNumber(value.systolic, 'systolic'),
		diastolic: nullableNumber(value.diastolic, 'diastolic'),
		temperature: nullableNumber(value.temperature, 'temperature'),
		heartRate: nullableNumber(value.heartRate, 'heartRate'),
		weight: nullableNumber(value.weight, 'weight'),
		height: nullableNumber(value.height, 'height'),
		notes: nullableString(value.notes, 'notes')
	};
}

function parseVisit(value: unknown): PatientHistoryVisit {
	if (!isRecord(value) || !isRecord(value.patient)) {
		throw new Error('Format data kunjungan atau pasien pada riwayat tidak valid.');
	}

	if (
		typeof value.status !== 'string' ||
		!statuses.includes(value.status as VisitStatus)
	) {
		throw new Error('Status kunjungan pada riwayat tidak dikenali.');
	}

	const patient = value.patient;

	return {
		visitId: requiredString(value.visitId, 'visitId'),
		date: requiredString(value.date, 'date'),
		complaint: nullableString(value.complaint, 'complaint'),
		status: value.status as VisitStatus,
		patient: {
			id: requiredString(patient.id, 'patient.id'),
			medicalRecordNumber: requiredString(
				patient.medicalRecordNumber,
				'patient.medicalRecordNumber'
			),
			name: requiredString(patient.name, 'patient.name'),
			gender: nullableString(patient.gender, 'patient.gender') || '-',
			age: nullableNumber(patient.age, 'patient.age')
		},
		nursingAssessment: parseAssessment(value.nursingAssessment)
	};
}

function timestamp(value: string): number {
	const result = Date.parse(value);
	return Number.isNaN(result) ? 0 : result;
}

// Create one store per dashboard instance rather than sharing patient data globally.
export function createNursePatientHistoryStore() {
	let visits = $state<PatientHistoryVisit[]>([]);
	let loading = $state(false);
	let error = $state('');
	let loaded = $state(false);
	let pendingRequest: Promise<boolean> | null = null;

	async function fetchHistory(): Promise<boolean> {
		loading = true;
		error = '';

		try {
			const response = await api.get<unknown>('/nurse/dashboard/patient-history');

			if (
				!isRecord(response) ||
				!isRecord(response.data) ||
				!Array.isArray(response.data.visits)
			) {
				throw new Error(
					'Format respons riwayat tidak sesuai: data.visits harus berupa array.'
				);
			}

			const nextVisits = response.data.visits.map(parseVisit);
			const ids = new Set(nextVisits.map((visit) => visit.visitId));
			if (ids.size !== nextVisits.length) {
				throw new Error('Respons riwayat memiliki visitId duplikat.');
			}

			visits = nextVisits.sort((a, b) => timestamp(b.date) - timestamp(a.date));
			loaded = true;
			return true;
		} catch (cause) {
			error =
				cause instanceof Error ? cause.message : 'Gagal memuat riwayat pasien.';
			return false;
		} finally {
			loading = false;
		}
	}

	function load(): Promise<boolean> {
		if (pendingRequest) return pendingRequest;

		pendingRequest = fetchHistory().finally(() => {
			pendingRequest = null;
		});
		return pendingRequest;
	}

	return {
		get visits() {
			return visits;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get loaded() {
			return loaded;
		},
		load
	};
}
