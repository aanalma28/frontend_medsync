<script lang="ts">
	import { api } from '$lib/api/api';

	export type NursingAssessmentForm = {
		systolic: number;
		diastolic: number;
		temperature: number;
		heartRate: number;
		weight: number;
		height: number;
		notes?: string;
	};

	type NumericField = Exclude<keyof NursingAssessmentForm, 'notes'>;
	type FormValues = Record<NumericField, string> & { notes: string };
	type FormErrors = Partial<Record<keyof FormValues, string>>;

	type Patient = {
		visitId: string;
		patientName: string;
		medicalRecordNumber: string;
		status: string;
	};

	type NumericFieldConfig = {
		key: NumericField;
		label: string;
		unit: string;
		integer: boolean;
	};

	interface Props {
		patient: Patient;
		open: boolean;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	const numericFields: NumericFieldConfig[] = [
		{ key: 'systolic', label: 'Tekanan darah sistolik', unit: 'mmHg', integer: true },
		{ key: 'diastolic', label: 'Tekanan darah diastolik', unit: 'mmHg', integer: true },
		{ key: 'temperature', label: 'Suhu tubuh', unit: '°C', integer: false },
		{ key: 'heartRate', label: 'Detak jantung', unit: 'bpm', integer: true },
		{ key: 'weight', label: 'Berat badan', unit: 'kg', integer: false },
		{ key: 'height', label: 'Tinggi badan', unit: 'cm', integer: false }
	];

	let { patient, open, onClose, onSaved }: Props = $props();
	let form = $state<FormValues>({
		systolic: '',
		diastolic: '',
		temperature: '',
		heartRate: '',
		weight: '',
		height: '',
		notes: ''
	});
	let errors = $state<FormErrors>({});
	let isSubmitting = $state(false);
	let isSaved = $state(false);
	let errorMessage = $state('');
	let dialog = $state<HTMLDialogElement | undefined>(undefined);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function numericError(value: unknown, field: NumericFieldConfig): string {
		if (typeof value !== 'string' || !value.trim()) {
			return `${field.label} wajib diisi.`;
		}

		const normalized = value.trim();
		const pattern = field.integer ? /^-?\d+$/ : /^-?\d+(?:[.,]\d+)?$/;

		if (!pattern.test(normalized)) {
			return field.integer
				? `${field.label} harus berupa bilangan bulat tanpa desimal.`
				: `${field.label} harus berupa angka, misalnya 36 atau 36.5.`;
		}

		const number = Number(normalized.replace(',', '.'));
		if (!Number.isFinite(number)) {
			return `${field.label} harus berupa angka yang terbatas.`;
		}

		if (field.integer && !Number.isSafeInteger(number)) {
			return `${field.label} harus berupa bilangan bulat dalam batas angka aman.`;
		}

		// The supplied DTO defines numeric types but no clinical minimum or maximum.
		return '';
	}

	function notesError(value: unknown): string {
		return typeof value === 'string' ? '' : 'Catatan perawat harus berupa teks.';
	}

	function validateField(key: keyof FormValues) {
		if (key === 'notes') {
			errors.notes = notesError(form.notes);
			return;
		}

		const field = numericFields.find((item) => item.key === key);
		if (field) errors[key] = numericError(form[key], field);
	}

	function readNumericInput(field: NumericFieldConfig, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const value = input.value;

		// Allow incomplete editing states, but validate complete values on blur and submit.
		// Reject letters, exponent notation, and invalid pasted content.
		const pattern = field.integer ? /^-?\d*$/ : /^-?\d*(?:[.,]\d*)?$/;

		if (pattern.test(value)) {
			form[field.key] = value;
			errors[field.key] = '';
		} else {
			input.value = form[field.key];
			errors[field.key] = field.integer
				? 'Hanya bilangan bulat yang diperbolehkan untuk kolom ini.'
				: 'Gunakan angka dengan maksimal satu pemisah desimal.';
		}
	}

	function createPayload(): NursingAssessmentForm | null {
		const nextErrors: FormErrors = {};
		const numbers = {} as Record<NumericField, number>;

		for (const field of numericFields) {
			const message = numericError(form[field.key], field);
			if (message) {
				nextErrors[field.key] = message;
			} else {
				numbers[field.key] = Number(form[field.key].trim().replace(',', '.'));
			}
		}

		const message = notesError(form.notes);
		if (message) nextErrors.notes = message;

		errors = nextErrors;
		if (Object.keys(nextErrors).length > 0) return null;

		const notes = form.notes.trim();
		return {
			...numbers,
			...(notes ? { notes } : {})
		};
	}

	function requestClose() {
		if (!isSubmitting) onClose();
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		requestClose();
	}

	async function submitAssessment(event: SubmitEvent) {
		event.preventDefault();
		if (isSubmitting || isSaved) return;

		errorMessage = '';

		if (patient.status !== 'REGISTERED') {
			errorMessage = 'Asesmen hanya dapat dibuat untuk kunjungan berstatus REGISTERED.';
			return;
		}

		if (typeof patient.visitId !== 'string' || !patient.visitId.trim()) {
			errorMessage = 'visitId tidak tersedia. Tutup modal dan muat ulang antrean.';
			return;
		}

		const payload = createPayload();
		if (!payload) {
			errorMessage = 'Periksa kembali kolom asesmen yang ditandai.';
			return;
		}

		isSubmitting = true;

		try {
			await api.post('/nurse/dashboard/nursing-assesment', {
				visitId: patient.visitId,
				...payload
			});

			// The backend changes the visit to NURSE_CHECKED when creation succeeds.
			// Never repeat the POST because a subsequent queue refresh fails.
			isSaved = true;

			try {
				await onSaved();
				onClose();
			} catch {
				errorMessage =
					'Asesmen sudah tersimpan, tetapi antrean gagal diperbarui. Tutup modal dan muat ulang antrean. Jangan kirim ulang asesmen.';
			}
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Gagal menyimpan asesmen keperawatan.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="assessment-dialog"
	aria-labelledby="assessment-title"
	aria-describedby="assessment-description"
	oncancel={handleCancel}
>
	<div class="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
		<div>
			<p class="text-xs font-bold tracking-[0.18em] text-teal-600 uppercase">Asesmen awal</p>
			<h2 id="assessment-title" class="mt-1 text-xl font-black text-slate-900">
				Asesmen Perawat
			</h2>
			<p class="mt-1 text-sm text-slate-500">
				{patient.medicalRecordNumber} · {patient.patientName}
			</p>
		</div>
		<button
			type="button"
			aria-label="Tutup modal"
			class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
			disabled={isSubmitting}
			onclick={requestClose}
		>
			<span class="text-2xl leading-none">&times;</span>
		</button>
	</div>

	<form class="space-y-5 px-5 py-6 sm:px-7" onsubmit={submitAssessment} novalidate>
		<p id="assessment-description" class="text-sm text-slate-500">
			Semua tanda vital wajib diisi. Tekanan darah dan detak jantung harus berupa bilangan
			bulat. Suhu, berat badan, dan tinggi badan dapat menggunakan desimal dengan titik
			atau koma. Catatan perawat opsional.
		</p>

		{#if errorMessage}
			<div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">
				{errorMessage}
			</div>
		{/if}

		{#if isSaved}
			<p class="text-sm font-semibold text-teal-700" role="status">
				Asesmen berhasil disimpan. Status kunjungan menjadi NURSE_CHECKED.
			</p>
		{/if}

		<fieldset disabled={isSubmitting || isSaved} class="space-y-5">
			<legend class="mb-3 text-sm font-bold text-slate-800">Tanda vital</legend>

			<div class="grid gap-4 sm:grid-cols-2">
				{#each numericFields as field (field.key)}
					<div>
						<label class="field-label" for={`assessment-${field.key}`}>
							{field.label} <small>({field.unit})</small>
						</label>
						<input
							id={`assessment-${field.key}`}
							name={field.key}
							class="field-input"
							type="text"
							inputmode={field.integer ? 'numeric' : 'decimal'}
							autocomplete="off"
							spellcheck={false}
							required
							value={form[field.key]}
							aria-invalid={Boolean(errors[field.key])}
							aria-describedby={`assessment-${field.key}-help assessment-${field.key}-error`}
							oninput={(event) => readNumericInput(field, event)}
							onblur={() => validateField(field.key)}
						/>
						<p id={`assessment-${field.key}-help`} class="mt-1 text-xs text-slate-500">
							{field.integer ? 'Bilangan bulat, tanpa desimal.' : 'Angka bulat atau desimal.'}
						</p>
						<p id={`assessment-${field.key}-error`} class="mt-1 text-xs text-rose-700">
							{errors[field.key] || ''}
						</p>
					</div>
				{/each}
			</div>

			<div>
				<label class="field-label" for="assessment-notes">
					Catatan perawat untuk dokter <small>(opsional)</small>
				</label>
				<textarea
					id="assessment-notes"
					name="notes"
					bind:value={form.notes}
					class="field-input"
					rows="4"
					placeholder="Tuliskan hasil pengamatan dan informasi penting untuk dokter"
					aria-invalid={Boolean(errors.notes)}
					aria-describedby="assessment-notes-error"
					oninput={() => (errors.notes = '')}
					onblur={() => validateField('notes')}
				></textarea>
				<p id="assessment-notes-error" class="mt-1 text-xs text-rose-700">
					{errors.notes || ''}
				</p>
			</div>
		</fieldset>

		<div class="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
			<button
				type="button"
				class="button-secondary"
				disabled={isSubmitting}
				onclick={requestClose}
			>
				{isSaved ? 'Tutup' : 'Batal'}
			</button>
			<button type="submit" class="button-primary" disabled={isSubmitting || isSaved}>
				{isSubmitting ? 'Menyimpan...' : isSaved ? 'Asesmen tersimpan' : 'Simpan Asesmen'}
			</button>
		</div>
	</form>
</dialog>

<style>
	.assessment-dialog {
		position: fixed;
		inset: 0;
		margin: auto;
		width: calc(100% - 2rem);
		max-width: 42rem;
		max-height: 94vh;
		overflow-y: auto;
		border: 0;
		border-radius: 1.5rem;
		padding: 0;
		background: white;
		color: #0f172a;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
	}

	.assessment-dialog::backdrop {
		background: rgb(2 6 23 / 0.5);
		backdrop-filter: blur(4px);
	}

	.field-label {
		display: block;
		margin-bottom: 0.4rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #475569;
	}

	.field-label small {
		font-weight: 500;
		color: #64748b;
	}

	.field-input {
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 0.75rem;
		padding: 0.65rem 0.8rem;
		font-size: 0.875rem;
		color: #0f172a;
		outline: none;
	}

	.field-input:focus {
		border-color: #14b8a6;
		box-shadow: 0 0 0 3px rgb(20 184 166 / 0.12);
	}

	.field-input[aria-invalid='true'] {
		border-color: #be123c;
	}

	.button-primary,
	.button-secondary {
		border-radius: 0.75rem;
		padding: 0.7rem 1rem;
		font-size: 0.875rem;
		font-weight: 700;
		transition: 150ms ease;
	}

	.button-primary {
		background: #0f766e;
		color: white;
	}

	.button-primary:hover:not(:disabled) {
		background: #115e59;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.button-secondary {
		border: 1px solid #cbd5e1;
		color: #475569;
	}

	.button-secondary:hover:not(:disabled) {
		background: #f8fafc;
	}
</style>
