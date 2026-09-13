<script lang="ts">
	import { api } from '$lib/api/api';

	export type NursingAssessmentForm = {
		complaint: string;
		allergy_history: string;
		sistolic: number | null;
		diastolic: number | null;
		temperature: number | null;
		heart_rate: number | null;
		weight: number | null;
		height: number | null;
	};

	type Patient = {
		id: string;
		patientName: string;
		patientId: string;
	};

	interface Props {
		patient: Patient;
		open: boolean;
		onClose: () => void;
		onSaved: () => Promise<void> | void;
	}

	let { patient, open, onClose, onSaved }: Props = $props();
	let form = $state<NursingAssessmentForm>(createInitialForm());
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	function createInitialForm(): NursingAssessmentForm {
		return {
			complaint: '',
			allergy_history: '',
			sistolic: null,
			diastolic: null,
			temperature: null,
			heart_rate: null,
			weight: null,
			height: null
		};
	}

	function numberOrNull(value: string): number | null {
		return value === '' ? null : Number(value);
	}

	function resetForm() {
		form = createInitialForm();
		errorMessage = '';
	}

	async function submitAssessment(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		if (Object.values(form).some((value) => value === null || (typeof value === 'string' && !value.trim()))) {
			errorMessage = 'Lengkapi seluruh data asesmen sebelum menyimpan.';
			return;
		}

		isSubmitting = true;
		try {
			await api.post(`/nurse/dashboard/appointments/${patient.id}/assessment`, form);
			await onSaved();
			resetForm();
			onClose();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal menyimpan asesmen keperawatan.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onclick={(event) => event.target === event.currentTarget && onClose()}>
		<div class="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="assessment-title">
			<div class="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
				<div>
					<p class="text-xs font-bold tracking-[0.18em] text-teal-600 uppercase">Asesmen awal</p>
					<h2 id="assessment-title" class="mt-1 text-xl font-black text-slate-900">Input Tanda Vital</h2>
					<p class="mt-1 text-sm text-slate-500">{patient.patientId} · {patient.patientName}</p>
				</div>
				<button type="button" aria-label="Tutup modal" class="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onclick={onClose}>
					<span class="text-2xl leading-none">&times;</span>
				</button>
			</div>

			<form class="space-y-5 px-5 py-6 sm:px-7" onsubmit={submitAssessment}>
				{#if errorMessage}
					<div class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{errorMessage}</div>
				{/if}

				<div class="grid gap-4 sm:grid-cols-2">
					<label class="sm:col-span-2"><span class="field-label">Keluhan utama</span><textarea bind:value={form.complaint} rows="3" class="field-input" placeholder="Tuliskan keluhan utama pasien"></textarea></label>
					<label class="sm:col-span-2"><span class="field-label">Riwayat alergi</span><textarea bind:value={form.allergy_history} rows="2" class="field-input" placeholder="Contoh: tidak ada / penisilin"></textarea></label>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-bold text-slate-800">Tanda vital</h3>
					<div class="grid gap-4 sm:grid-cols-2">
						<label><span class="field-label">Tekanan darah atas <small>(mmHg)</small></span><input class="field-input" type="number" min="1" bind:value={form.sistolic} /></label>
						<label><span class="field-label">Tekanan darah bawah <small>(mmHg)</small></span><input class="field-input" type="number" min="1" bind:value={form.diastolic} /></label>
						<label><span class="field-label">Suhu tubuh <small>(°C)</small></span><input class="field-input" type="number" min="1" step="0.1" bind:value={form.temperature} /></label>
						<label><span class="field-label">Denyut nadi <small>(bpm)</small></span><input class="field-input" type="number" min="1" bind:value={form.heart_rate} /></label>
						<label><span class="field-label">Berat badan <small>(kg)</small></span><input class="field-input" type="number" min="1" step="0.1" bind:value={form.weight} /></label>
						<label><span class="field-label">Tinggi badan <small>(cm)</small></span><input class="field-input" type="number" min="1" bind:value={form.height} /></label>
					</div>
				</div>

				<div class="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
					<button type="button" class="button-secondary" onclick={onClose}>Batal</button>
					<button type="submit" class="button-primary" disabled={isSubmitting}>{isSubmitting ? 'Mengirim...' : 'Simpan & Kirim ke Dokter'}</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<svelte:head>
	<style>
		:global(.field-label) { display: block; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 700; color: #475569; }
		:global(.field-label small) { font-weight: 500; color: #94a3b8; }
		:global(.field-input) { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.75rem; padding: 0.65rem 0.8rem; font-size: 0.875rem; color: #0f172a; outline: none; }
		:global(.field-input:focus) { border-color: #14b8a6; box-shadow: 0 0 0 3px rgb(20 184 166 / 0.12); }
		:global(.button-primary), :global(.button-secondary) { border-radius: 0.75rem; padding: 0.7rem 1rem; font-size: 0.875rem; font-weight: 700; transition: 150ms ease; }
		:global(.button-primary) { background: #0f766e; color: white; }
		:global(.button-primary:hover:not(:disabled)) { background: #115e59; }
		:global(.button-primary:disabled) { cursor: wait; opacity: 0.6; }
		:global(.button-secondary) { border: 1px solid #cbd5e1; color: #475569; }
		:global(.button-secondary:hover) { background: #f8fafc; }
	</style>
</svelte:head>