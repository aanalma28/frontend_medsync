<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Title from '$lib/components/Title.svelte';
	import NursingAssessmentModal from '$lib/components/NursingAssessmentModal.svelte';
	import NursePatientHistoryDetailModal from '$lib/components/NursePatientHistoryDetailModal.svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import {
		createNursePatientHistoryStore,
		type VisitStatus
	} from '$lib/stores/nursePatientHistory.svelte';

	type Patient = {
		visitId: string;
		registrationTime: string;
		status: VisitStatus;
		payerType: string;
		queueNumber: string;
		medicalRecordNumber: string;
		patientName: string;
		gender: string;
		age: number | null;
		slot: {
			name: string;
			startHour: string;
			endHour: string;
		};
	};

	const visitStatuses: VisitStatus[] = [
		'REGISTERED',
		'NURSE_CHECKED',
		'DOCTOR_EXAMINED',
		'CANCELLED',
		'COMPLETED'
	];

	const statusLabels: Record<VisitStatus, string> = {
		REGISTERED: 'Menunggu asesmen',
		NURSE_CHECKED: 'Sudah diperiksa perawat',
		DOCTOR_EXAMINED: 'Sudah diperiksa dokter',
		CANCELLED: 'Dibatalkan',
		COMPLETED: 'Selesai'
	};

	const historyStore = createNursePatientHistoryStore();

	let isLoading = $state(true);
	let isQueueLoading = $state(false);
	let isForbidden = $state(false);
	let loadError = $state('');
	let actionError = $state('');
	let actionMessage = $state('');
	let cancellingVisitId = $state<string | null>(null);
	let currentUser = $state<{ name: string; id: string; user_code?: string }>({
		name: '',
		id: ''
	});
	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);
	let patients = $state<Patient[]>([]);
	let assessmentPatient = $state<Patient | null>(null);
	let todayLabel = $state('');
	let historySearch = $state('');
	let selectedHistoryPatientId = $state('');
	let historyMedicalRecordFilter = $state('');
	let selectedHistoryVisitId = $state<string | null>(null);

	const isHistoryMenu = $derived(activeMenu === 'riwayat');
	const currentLoading = $derived(isHistoryMenu ? historyStore.loading : isQueueLoading);
	const selectedHistoryVisit = $derived(
		historyStore.visits.find((visit) => visit.visitId === selectedHistoryVisitId) ?? null
	);

	const historyPatients = $derived.by(() => {
		const uniquePatients = new Map<
			string,
			{ id: string; name: string; medicalRecordNumber: string }
		>();

		for (const visit of historyStore.visits) {
			if (!uniquePatients.has(visit.patient.id)) {
				uniquePatients.set(visit.patient.id, {
					id: visit.patient.id,
					name: visit.patient.name,
					medicalRecordNumber: visit.patient.medicalRecordNumber
				});
			}
		}

		return [...uniquePatients.values()].sort((a, b) =>
			a.name.localeCompare(b.name, 'id')
		);
	});

	const filteredHistory = $derived.by(() => {
		const query = historySearch.trim().toLocaleLowerCase('id-ID');

		return historyStore.visits.filter((visit) => {
			if (
				selectedHistoryPatientId &&
				visit.patient.id !== selectedHistoryPatientId
			) {
				return false;
			}

			if (
				historyMedicalRecordFilter &&
				visit.patient.medicalRecordNumber.trim() !== historyMedicalRecordFilter
			) {
				return false;
			}

			if (!query) return true;

			return [
				visit.patient.name,
				visit.patient.medicalRecordNumber,
				visit.complaint || '',
				visit.status,
				statusLabels[visit.status]
			].some((value) => value.toLocaleLowerCase('id-ID').includes(query));
		});
	});

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function text(value: unknown, fallback = '-'): string {
		if (typeof value === 'string' && value.trim()) return value.trim();
		if (typeof value === 'number' && Number.isFinite(value)) return String(value);
		return fallback;
	}

	function genderLabel(value: unknown): string {
		const gender = text(value);
		switch (gender.toUpperCase()) {
			case 'LAKILAKI':
			case 'LAKI-LAKI':
			case 'L':
				return 'Laki-laki';
			case 'PEREMPUAN':
			case 'P':
				return 'Perempuan';
			default:
				return gender;
		}
	}

	function normalizePatient(value: unknown): Patient {
		if (!isRecord(value) || !isRecord(value.patient) || !isRecord(value.slot)) {
			throw new Error('Format data pasien atau jadwal praktik tidak sesuai respons antrean.');
		}

		if (typeof value.visitId !== 'string' || !value.visitId.trim()) {
			throw new Error('Data antrean tidak memiliki visitId yang valid.');
		}

		if (
			typeof value.status !== 'string' ||
			!visitStatuses.includes(value.status as VisitStatus)
		) {
			throw new Error('Data antrean memiliki status kunjungan yang tidak dikenali.');
		}

		const patient = value.patient;
		const age =
			typeof patient.age === 'number' && Number.isFinite(patient.age)
				? patient.age
				: null;

		return {
			visitId: value.visitId,
			registrationTime: text(value.registrationTime),
			status: value.status as VisitStatus,
			payerType: text(value.payerType),
			queueNumber: text(value.queueNumber),
			medicalRecordNumber: text(patient.medicalRecordNumber),
			patientName: text(patient.name, 'Nama tidak tersedia'),
			gender: genderLabel(patient.gender),
			age,
			slot: {
				name: text(value.slot.name),
				startHour: text(value.slot.startHour),
				endHour: text(value.slot.endHour)
			}
		};
	}

	async function fetchQueue(): Promise<boolean> {
		if (isQueueLoading) return false;
		isQueueLoading = true;
		loadError = '';

		try {
			const response = await api.get<unknown>('/nurse/dashboard/visits/queue');

			if (!isRecord(response) || !Array.isArray(response.data)) {
				throw new Error('Format respons antrean tidak sesuai: data harus berupa array.');
			}

			const nextPatients = response.data.map(normalizePatient);
			const visitIds = new Set(nextPatients.map((patient) => patient.visitId));
			if (visitIds.size !== nextPatients.length) {
				throw new Error('Respons antrean memiliki visitId duplikat.');
			}

			patients = nextPatients;
			return true;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Gagal memuat antrean poli.';
			return false;
		} finally {
			isQueueLoading = false;
		}
	}

	function updateLocalStatus(visitId: string, status: VisitStatus) {
		patients = patients.map((patient) =>
			patient.visitId === visitId ? { ...patient, status } : patient
		);
	}

	async function handleAssessmentSaved() {
		if (!assessmentPatient) return;

		// Assessment creation updates this status in the backend.
		// Preserve the saved status locally even if refreshing the queue fails.
		updateLocalStatus(assessmentPatient.visitId, 'NURSE_CHECKED');
		actionMessage = 'Asesmen berhasil disimpan. Status kunjungan: NURSE_CHECKED.';

		if (!(await fetchQueue())) {
			throw new Error('Asesmen tersimpan, tetapi antrean gagal diperbarui.');
		}
	}

	function canCancel(status: VisitStatus): boolean {
		return status === 'REGISTERED' || status === 'NURSE_CHECKED';
	}

	async function cancelVisit(patient: Patient) {
		if (isQueueLoading || cancellingVisitId || !canCancel(patient.status)) return;

		const confirmed = window.confirm(
			`Batalkan kunjungan ${patient.patientName} dengan nomor antrean ${patient.queueNumber}?`
		);
		if (!confirmed) return;

		cancellingVisitId = patient.visitId;
		actionError = '';
		actionMessage = '';

		try {
			await api.patch(
				`/nurse/dashboard/visits/${encodeURIComponent(patient.visitId)}/status`,
				{ status: 'CANCELLED' }
			);

			updateLocalStatus(patient.visitId, 'CANCELLED');
			actionMessage = 'Kunjungan berhasil dibatalkan.';

			if (!(await fetchQueue())) {
				actionMessage =
					'Kunjungan berhasil dibatalkan, tetapi antrean gagal diperbarui. Silakan muat ulang.';
			}
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Gagal membatalkan kunjungan.';
		} finally {
			cancellingVisitId = null;
		}
	}

	function openAssessment(patient: Patient) {
		if (patient.status !== 'REGISTERED' || isQueueLoading || cancellingVisitId) return;
		actionError = '';
		actionMessage = '';
		assessmentPatient = patient;
	}

	function resetHistoryFilters() {
		historySearch = '';
		selectedHistoryPatientId = '';
		historyMedicalRecordFilter = '';
	}

	async function openHistory(patient: Patient) {
		if (patient.medicalRecordNumber === '-') return;

		resetHistoryFilters();
		selectedHistoryVisitId = null;
		historyMedicalRecordFilter = patient.medicalRecordNumber.trim();
		activeMenu = 'riwayat';
		isSidebarOpen = false;
		await historyStore.load();
	}

	async function handleMenuSelect(menu: string) {
		activeMenu = menu;
		isSidebarOpen = false;
		selectedHistoryVisitId = null;

		if (menu === 'riwayat') {
			resetHistoryFilters();
			await historyStore.load();
		}
	}

	async function reloadCurrentView() {
		if (isHistoryMenu) {
			await historyStore.load();
		} else {
			await fetchQueue();
		}
	}

	function statusClass(status: VisitStatus): string {
		return {
			REGISTERED: 'bg-amber-50 text-amber-700 ring-amber-200',
			NURSE_CHECKED: 'bg-teal-50 text-teal-700 ring-teal-200',
			DOCTOR_EXAMINED: 'bg-sky-50 text-sky-700 ring-sky-200',
			CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
			COMPLETED: 'bg-slate-100 text-slate-700 ring-slate-200'
		}[status];
	}

	function payerClass(payer: string): string {
		switch (payer.toUpperCase()) {
			case 'BPJS':
				return 'bg-emerald-50 text-emerald-700';
			case 'B2B':
				return 'bg-violet-50 text-violet-700';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}

	function timeLabel(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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

	onMount(async () => {
		todayLabel = new Date().toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		try {
			const profile = await validateSession();
			if (!['nurse', 'perawat'].includes(profile.role.toLowerCase())) {
				isForbidden = true;
			} else {
				currentUser = profile;
				await fetchQueue();
			}
		} catch (error) {
			console.error('Gagal verifikasi sesi perawat:', error);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});
</script>

<Title title={isHistoryMenu ? 'Perawat | Riwayat Pasien' : 'Perawat | Antrean Poli'} />

<div class="flex h-screen overflow-hidden bg-[#f3f8f7] font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if !isForbidden}
		<Sidebar
			role="perawat"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={handleMenuSelect}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if isForbidden}
			<ErrorState status={403} />
		{:else}
			<header class="flex items-center justify-between border-b border-teal-100 bg-white px-5 py-4 shadow-sm lg:hidden">
				<button type="button" aria-label="Buka menu" class="text-teal-700" onclick={() => (isSidebarOpen = true)}>
					<span class="text-2xl">☰</span>
				</button>
				<span class="text-xs font-bold text-teal-700">{currentUser.user_code || currentUser.id}</span>
			</header>

			<div class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
				<div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p class="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase">Panel keperawatan</p>
						<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900">
							{isHistoryMenu ? 'Riwayat Pasien' : 'Antrean Poli'}
						</h1>
						<p class="mt-1 text-sm text-slate-500">
							{todayLabel} · Selamat bertugas, {currentUser.name || 'Perawat'}
						</p>
					</div>
					<button
						type="button"
						class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-sm hover:bg-teal-50 disabled:opacity-50"
						disabled={isLoading || currentLoading || cancellingVisitId !== null}
						onclick={reloadCurrentView}
					>
						{currentLoading ? 'Memuat...' : 'Muat ulang'}
					</button>
				</div>

				{#if isHistoryMenu}
					{#if historyStore.error}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{historyStore.error}
							{#if historyStore.loaded}
								<p class="mt-1">Data yang ditampilkan mungkin belum terbaru.</p>
							{/if}
						</div>
					{/if}

					<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 p-5">
							<h2 class="font-bold text-slate-900">Daftar Riwayat Pasien</h2>
							<p class="mt-1 text-sm text-slate-500">
								Pilih Detail untuk melihat informasi kunjungan dan asesmen perawat.
							</p>

							<div class="mt-4 grid gap-3 md:grid-cols-2">
								<div>
									<label for="history-search" class="mb-1 block text-xs font-semibold text-slate-600">
										Cari riwayat
									</label>
									<input
										id="history-search"
										type="search"
										bind:value={historySearch}
										placeholder="Nama, rekam medis, keluhan, atau status"
										class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
									/>
								</div>
								<div>
									<label for="history-patient" class="mb-1 block text-xs font-semibold text-slate-600">
										Filter pasien
									</label>
									<select
										id="history-patient"
										bind:value={selectedHistoryPatientId}
										onchange={() => (historyMedicalRecordFilter = '')}
										class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
									>
										<option value="">Semua pasien</option>
										{#each historyPatients as patient (patient.id)}
											<option value={patient.id}>
												{patient.name} — {patient.medicalRecordNumber}
											</option>
										{/each}
									</select>
								</div>
							</div>

							{#if historyMedicalRecordFilter}
								<p class="mt-3 text-xs font-semibold text-teal-700">
									Rekam medis terpilih: {historyMedicalRecordFilter}
								</p>
							{/if}

							<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
								<p class="text-xs text-slate-500" aria-live="polite">
									{filteredHistory.length} dari {historyStore.visits.length} kunjungan
								</p>
								{#if historySearch || selectedHistoryPatientId || historyMedicalRecordFilter}
									<button
										type="button"
										class="text-xs font-semibold text-teal-700 hover:text-teal-900"
										onclick={resetHistoryFilters}
									>
										Hapus filter
									</button>
								{/if}
							</div>
						</div>

						{#if historyStore.loading}
							<p class="border-b border-slate-100 px-5 py-3 text-sm text-slate-500" role="status">
								Memuat riwayat pasien...
							</p>
						{/if}

						<div class="overflow-x-auto" aria-busy={historyStore.loading}>
							<table class="w-full min-w-[800px] text-left text-sm">
								<caption class="sr-only">Daftar riwayat kunjungan pasien</caption>
								<thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
									<tr>
										<th scope="col" class="px-5 py-3">Pasien</th>
										<th scope="col" class="px-5 py-3">Tanggal kunjungan</th>
										<th scope="col" class="px-5 py-3">Keluhan</th>
										<th scope="col" class="px-5 py-3">Status</th>
										<th scope="col" class="px-5 py-3 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredHistory as visit (visit.visitId)}
										<tr class="hover:bg-teal-50/30">
											<td class="px-5 py-4">
												<p class="font-semibold text-slate-900">{visit.patient.name}</p>
												<p class="mt-1 text-xs text-slate-500">{visit.patient.medicalRecordNumber}</p>
											</td>
											<td class="px-5 py-4 text-slate-600">
												{dateTimeLabel(visit.date)}
											</td>
											<td class="px-5 py-4 text-slate-600">
												<p class="max-w-[200px] truncate">
													{visit.complaint?.trim() || '-'}
												</p>
											</td>
											<td class="px-5 py-4">
												<span
													title={visit.status}
													class={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(visit.status)}`}
												>
													{statusLabels[visit.status]}
												</span>
											</td>
											<td class="px-5 py-4 text-right">
												<button
													type="button"
													aria-label={`Lihat detail kunjungan ${visit.patient.name}, ${dateTimeLabel(visit.date)}`}
													aria-haspopup="dialog"
													class="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600"
													onclick={() => (selectedHistoryVisitId = visit.visitId)}
												>
													Detail
												</button>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="5" class="px-5 py-14 text-center text-sm text-slate-500">
												{historyStore.loading
													? 'Memuat riwayat pasien...'
													: historyStore.error
														? 'Riwayat gagal dimuat. Silakan tekan Muat ulang.'
														: historySearch || selectedHistoryPatientId || historyMedicalRecordFilter
															? 'Tidak ada riwayat yang sesuai dengan filter.'
															: 'Belum ada riwayat pasien.'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{:else}
					{#if loadError}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{loadError}
							{#if patients.length > 0}
								<p class="mt-1">Data yang ditampilkan mungkin belum terbaru.</p>
							{/if}
						</div>
					{/if}

					{#if actionError}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{actionError}
						</div>
					{/if}

					{#if actionMessage}
						<div class="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700" role="status">
							{actionMessage}
						</div>
					{/if}

					{#if isLoading || isQueueLoading}
						<p class="mb-5 text-sm text-slate-500" role="status">Memuat antrean pasien...</p>
					{/if}

					<div class="mb-5 grid gap-3 sm:grid-cols-3">
						<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Total kunjungan</p>
							<p class="mt-1 text-2xl font-black">{patients.length}</p>
						</div>
						<div class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Menunggu asesmen</p>
							<p class="mt-1 text-2xl font-black text-amber-600">
								{patients.filter((patient) => patient.status === 'REGISTERED').length}
							</p>
						</div>
						<div class="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Status NURSE_CHECKED</p>
							<p class="mt-1 text-2xl font-black text-teal-600">
								{patients.filter((patient) => patient.status === 'NURSE_CHECKED').length}
							</p>
						</div>
					</div>

					<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 px-5 py-4">
							<h2 class="font-bold text-slate-900">Daftar pasien hari ini</h2>
							<p class="mt-1 text-xs text-slate-500">
								Fitur panggil pasien belum tersedia. Menyimpan asesmen akan mengubah status menjadi NURSE_CHECKED.
							</p>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full min-w-[1100px] text-left text-sm">
								<thead class="bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
									<tr>
										<th class="px-5 py-4">Antrean / Jam daftar</th>
										<th class="px-5 py-4">Rekam medis / Pasien</th>
										<th class="px-5 py-4">Jenis kelamin / Umur</th>
										<th class="px-5 py-4">Jadwal praktik</th>
										<th class="px-5 py-4">Penjamin</th>
										<th class="px-5 py-4">Status kunjungan</th>
										<th class="px-5 py-4">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each patients as patient (patient.visitId)}
										<tr class="align-top hover:bg-teal-50/30">
											<td class="px-5 py-4">
												<p class="font-black text-teal-700">{patient.queueNumber}</p>
												<p class="mt-1 text-xs text-slate-500">{timeLabel(patient.registrationTime)}</p>
											</td>
											<td class="px-5 py-4">
												<p class="font-bold text-slate-900">{patient.medicalRecordNumber}</p>
												<p class="mt-1 text-slate-600">{patient.patientName}</p>
											</td>
											<td class="px-5 py-4 text-slate-600">
												{patient.gender}<br /><span class="text-xs">{patient.age ?? '-'} tahun</span>
											</td>
											<td class="px-5 py-4 text-slate-600">
												<p class="font-semibold">{patient.slot.name}</p>
												<p class="mt-1 text-xs">{patient.slot.startHour} – {patient.slot.endHour}</p>
											</td>
											<td class="px-5 py-4">
												<span class={`rounded-lg px-2.5 py-1 text-xs font-bold ${payerClass(patient.payerType)}`}>
													{patient.payerType}
												</span>
											</td>
											<td class="px-5 py-4">
												<span
													title={patient.status}
													class={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusClass(patient.status)}`}
												>
													{statusLabels[patient.status]}
												</span>
											</td>
											<td class="px-5 py-4">
												<div class="flex flex-col items-start gap-3">
													{#if patient.status === 'REGISTERED'}
														<button
															type="button"
															class="cursor-not-allowed text-xs font-bold text-slate-400"
															disabled
															title="Mekanisme notifikasi panggilan belum diimplementasikan"
														>
															Panggil pasien (segera hadir)
														</button>
														<button
															type="button"
															class="text-xs font-bold text-teal-700 hover:text-teal-900 disabled:opacity-50"
															disabled={isQueueLoading || cancellingVisitId !== null}
															onclick={() => openAssessment(patient)}
														>
															Input Asesmen Perawat
														</button>
													{:else if patient.status === 'NURSE_CHECKED'}
														<span class="text-xs font-semibold text-teal-700">Asesmen tersimpan</span>
													{/if}

													{#if canCancel(patient.status)}
														<button
															type="button"
															class="text-xs font-bold text-rose-700 hover:text-rose-900 disabled:opacity-50"
															disabled={isQueueLoading || cancellingVisitId !== null}
															onclick={() => cancelVisit(patient)}
														>
															{cancellingVisitId === patient.visitId ? 'Membatalkan...' : 'Batalkan kunjungan'}
														</button>
													{/if}

													<button
														type="button"
														class="text-xs font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800 disabled:opacity-50"
														disabled={patient.medicalRecordNumber === '-'}
														onclick={() => openHistory(patient)}
													>
														Lihat Riwayat
													</button>
												</div>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="7" class="px-5 py-14 text-center text-sm text-slate-500">
												{isLoading || isQueueLoading ? 'Memuat antrean pasien...' : loadError ? 'Antrean pasien gagal dimuat. Silakan muat ulang.' : 'Belum ada pasien pada antrean hari ini.'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			</div>
		{/if}
	</main>
</div>

{#if assessmentPatient}
	{#key assessmentPatient.visitId}
		<NursingAssessmentModal
			patient={assessmentPatient}
			open={true}
			onClose={() => (assessmentPatient = null)}
			onSaved={handleAssessmentSaved}
		/>
	{/key}
{/if}

{#if isHistoryMenu && selectedHistoryVisit && !isForbidden}
	{#key selectedHistoryVisit.visitId}
		<NursePatientHistoryDetailModal
			visit={selectedHistoryVisit}
			onClose={() => (selectedHistoryVisitId = null)}
		/>
	{/key}
{/if}
