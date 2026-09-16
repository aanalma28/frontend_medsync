<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		PatientHistoryVisit,
		VisitStatus
	} from '$lib/stores/nursePatientHistory.svelte';

	interface Props {
		visit: PatientHistoryVisit;
		onClose: () => void;
	}

	let { visit, onClose }: Props = $props();
	let dialog: HTMLDialogElement;

	const statusLabels: Record<VisitStatus, string> = {
		REGISTERED: 'Menunggu asesmen',
		NURSE_CHECKED: 'Sudah diperiksa perawat',
		DOCTOR_EXAMINED: 'Sudah diperiksa dokter',
		CANCELLED: 'Dibatalkan',
		COMPLETED: 'Selesai'
	};

	const assessmentFields = [
		{ key: 'systolic', label: 'Tekanan darah sistolik', unit: 'mmHg' },
		{ key: 'diastolic', label: 'Tekanan darah diastolik', unit: 'mmHg' },
		{ key: 'temperature', label: 'Suhu tubuh', unit: '°C' },
		{ key: 'heartRate', label: 'Detak jantung', unit: 'bpm' },
		{ key: 'weight', label: 'Berat badan', unit: 'kg' },
		{ key: 'height', label: 'Tinggi badan', unit: 'cm' }
	] as const;

	function genderLabel(value: string): string {
		switch (value.toUpperCase()) {
			case 'LAKILAKI':
			case 'LAKI-LAKI':
			case 'L':
				return 'Laki-laki';
			case 'PEREMPUAN':
			case 'P':
				return 'Perempuan';
			default:
				return value || '-';
		}
	}

	function dateTimeLabel(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';

		return date.toLocaleString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		onClose();
	}

	onMount(() => {
		dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	class="history-dialog"
	aria-labelledby="history-detail-title"
	oncancel={handleCancel}
>
	<div class="flex max-h-[90dvh] flex-col">
		<header class="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
			<div>
				<h2 id="history-detail-title" class="text-lg font-bold text-slate-900">
					Detail Riwayat Pasien
				</h2>
				<p class="mt-1 text-xs text-slate-500">{dateTimeLabel(visit.date)}</p>
			</div>
			<button
				type="button"
				aria-label="Tutup detail riwayat"
				class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
				onclick={onClose}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="h-5 w-5"
					aria-hidden="true"
				>
					<path stroke-linecap="round" d="m6 6 12 12M18 6 6 18" />
				</svg>
			</button>
		</header>

		<div class="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
			<section class="rounded-xl bg-slate-50 p-4" aria-labelledby="history-patient-title">
				<h3 id="history-patient-title" class="font-bold text-slate-900">
					{visit.patient.name}
				</h3>
				<p class="mt-1 text-sm text-slate-600">
					{visit.patient.medicalRecordNumber} · {genderLabel(visit.patient.gender)} · {visit.patient.age ?? '-'} tahun
				</p>
				<p class="mt-3 text-xs font-semibold text-teal-700">
					Status: {statusLabels[visit.status]}
				</p>
			</section>

			<section aria-labelledby="history-complaint-title">
				<h3 id="history-complaint-title" class="text-sm font-bold text-slate-900">Keluhan</h3>
				<p class="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
					{visit.complaint?.trim() || 'Tidak ada keluhan tercatat.'}
				</p>
			</section>

			<section aria-labelledby="history-assessment-title">
				<h3 id="history-assessment-title" class="text-sm font-bold text-slate-900">
					Asesmen Perawat
				</h3>

				{#if visit.nursingAssessment}
					<dl class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each assessmentFields as field (field.key)}
							<div class="rounded-xl border border-slate-200 p-3">
								<dt class="text-xs text-slate-500">{field.label}</dt>
								<dd class="mt-1 text-sm font-semibold text-slate-900">
									{#if visit.nursingAssessment[field.key] === null}
										-
									{:else}
										{visit.nursingAssessment[field.key]} {field.unit}
									{/if}
								</dd>
							</div>
						{/each}
					</dl>

					<div class="mt-4">
						<h4 class="text-sm font-bold text-slate-900">Catatan Perawat untuk Dokter</h4>
						<p class="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
							{visit.nursingAssessment.notes?.trim() || 'Tidak ada catatan perawat.'}
						</p>
					</div>
				{:else}
					<p class="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
						Belum ada asesmen perawat untuk kunjungan ini.
					</p>
				{/if}
			</section>
		</div>

		<footer class="flex shrink-0 justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
			<button
				type="button"
				class="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
				onclick={onClose}
			>
				Tutup
			</button>
		</footer>
	</div>
</dialog>

<style>
	.history-dialog {
		position: fixed;
		inset: 0;
		width: calc(100% - 2rem);
		max-width: 40rem;
		max-height: 90dvh;
		margin: auto;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: 1rem;
		background: white;
		color: #0f172a;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
	}

	.history-dialog::backdrop {
		background: rgb(15 23 42 / 0.5);
	}
</style>
