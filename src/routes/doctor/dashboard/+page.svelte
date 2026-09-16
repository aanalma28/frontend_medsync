<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount, tick } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonDokter from '$lib/components/skeleton/DashboardSkeletonDokter.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import {
		doctorPracticeStore,
		canExaminePatient,
		canCancelPatient,
		parseBackendError,
		type PracticeSessionCard,
		type RegisteredPatient
	} from '$lib/stores/doctorPractice.svelte';
	import type {
		AppointmentStatus,
		VisitStatus,
		NurseAssessment
	} from '$lib/stores/patientAppointment.svelte';

	type DashboardUser = { role: string; name: string; id: string; user_code?: string };
	type SlotForm = {
		sessionName: string;
		startTime: string;
		endTime: string;
		quota: number;
	};
	type MedicineSelection = { name: string; usage: string };
	type Receipt = {
		patientName: string;
		patientId: string;
		doctorName: string;
		date: string;
		diagnosis: string;
		medicines: MedicineSelection[];
	};

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<DashboardUser>({ role: 'dokter', name: '', id: '', user_code: '' });
	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	function localDateString(date: Date): string {
		return [
			date.getFullYear(),
			String(date.getMonth() + 1).padStart(2, '0'),
			String(date.getDate()).padStart(2, '0')
		].join('-');
	}

	let todayDateStr = $state(localDateString(new Date()));
	let todayDateDisplay = $derived(
		new Date(`${todayDateStr}T00:00:00`).toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);

	onMount(() => {
		let disposed = false;

		async function initialize() {
			try {
				const profile = await validateSession();
				if (disposed) return;
				if (profile.role.toLowerCase() !== 'general_doctor') {
					isForbidden = true;
				} else {
					currentUser = profile;
					await Promise.allSettled([
						doctorPracticeStore.fetchSchedules(),
						doctorPracticeStore.fetchTodayPatients(),
						doctorPracticeStore.fetchPatientHistory()
					]);
				}
			} catch (err) {
				console.error('Gagal verifikasi sesi dokter:', err);
				if (!disposed) isForbidden = true;
			} finally {
				if (!disposed) isLoading = false;
			}
		}

		void initialize();
		const dateTimer = setInterval(() => {
			const nextDate = localDateString(new Date());
			if (nextDate !== todayDateStr && !isLoading && !isForbidden && !isPatientActionPending && !isRefreshingPatients) {
				todayDateStr = nextDate;
				selectedAppointmentId = null;
				diagnosis = '';
				searchQuery = '';
				selectedMedicines = [];
				void refreshPatients();
			}
		}, 60000);

		return () => {
			disposed = true;
			clearInterval(dateTimer);
			if (toastTimer) clearTimeout(toastTimer);
		};
	});

	// The endpoint supplies every status for today; the store sorts by visit status.
	// An empty queue must not fall back to potentially stale schedule data.
	let todayPatients = $derived(doctorPracticeStore.todayPatients);
	let selectedAppointmentId = $state<string | null>(null);
	let selectedAppointment = $derived(
		todayPatients.find((patient) => patient.id === selectedAppointmentId)
	);
	let activePatient = $derived(
		canExaminePatient(selectedAppointment) ? selectedAppointment : undefined
	);
	let todayStats = $derived({
		total: todayPatients.length,
		waitingNurse: todayPatients.filter((patient) => patient.backendStatus === 'REGISTERED').length,
		ready: todayPatients.filter(canExaminePatient).length,
		examined: todayPatients.filter((patient) => patient.backendStatus === 'DOCTOR_EXAMINED').length,
		cancelled: todayPatients.filter((patient) => patient.backendStatus === 'CANCELLED').length,
		completed: todayPatients.filter((patient) => patient.backendStatus === 'COMPLETED').length
	});

	function statusClass(status: VisitStatus | null): string {
		switch (status) {
			case 'REGISTERED':
				return 'bg-amber-100 text-amber-800';
			case 'NURSE_CHECKED':
				return 'bg-sky-100 text-sky-800';
			case 'DOCTOR_EXAMINED':
				return 'bg-emerald-100 text-emerald-800';
			case 'COMPLETED':
				return 'bg-slate-200 text-slate-700';
			case 'CANCELLED':
				return 'bg-rose-100 text-rose-800';
			default:
				return 'bg-slate-100 text-slate-600';
		}
	}

	function appointmentStatusLabel(status: AppointmentStatus | null): string {
		switch (status) {
			case 'PENDING':
				return 'Menunggu Konfirmasi';
			case 'CONFIRMED':
				return 'Dikonfirmasi';
			case 'CANCELLED':
				return 'Dibatalkan';
			case 'COMPLETED':
				return 'Selesai';
			default:
				return 'Belum tersedia';
		}
	}

	let diagnosis = $state('');
	let searchQuery = $state('');
	let selectedMedicines = $state<MedicineSelection[]>([]);
	let receipt = $state<Receipt | null>(null);
	let isFinishing = $state(false);
	let cancellingAppointmentId = $state<string | null>(null);
	let isPatientActionPending = $derived(isFinishing || cancellingAppointmentId !== null);
	let isRefreshingPatients = $state(false);

	const medicineCatalog = [
		{ name: 'Paracetamol 500mg', category: 'Analgesik', notes: 'Penurun demam & pereda nyeri' },
		{ name: 'Amoxicillin 500mg', category: 'Antibiotik', notes: 'Infeksi bakteri ringan-sedang' },
		{ name: 'Omeprazole 20mg', category: 'Pencernaan', notes: 'Menurunkan asam lambung' },
		{ name: 'Isosorbide Dinitrate 5mg', category: 'Jantung', notes: 'Nyeri dada angina' },
		{ name: 'Cetirizine 10mg', category: 'Antihistamin', notes: 'Alergi & gatal' },
		{ name: 'Vitamin C 500mg', category: 'Suplemen', notes: 'Daya tahan tubuh' }
	];

	let filteredMedicines = $derived(
		medicineCatalog.filter((medicine) => {
			const query = searchQuery.trim().toLowerCase();
			return [medicine.name, medicine.category, medicine.notes].some((value) =>
				value.toLowerCase().includes(query)
			);
		})
	);

	function toggleMedicine(name: string) {
		if (!activePatient || isPatientActionPending || isRefreshingPatients) return;
		const existing = selectedMedicines.some((medicine) => medicine.name === name);
		selectedMedicines = existing
			? selectedMedicines.filter((medicine) => medicine.name !== name)
			: [...selectedMedicines, { name, usage: '' }];
	}

	function updateMedicineUsage(name: string, usage: string) {
		if (!activePatient || isPatientActionPending || isRefreshingPatients) return;
		selectedMedicines = selectedMedicines.map((medicine) =>
			medicine.name === name ? { ...medicine, usage } : medicine
		);
	}

	let toastNotification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		if (toastTimer) clearTimeout(toastTimer);
		toastNotification = { type, message };
		toastTimer = setTimeout(() => {
			toastNotification = null;
		}, 6000);
	}

	// Calling a patient is local selection only. Both backend statuses remain unchanged.
	function handleCallPatient(appointmentId: string) {
		if (isPatientActionPending || isRefreshingPatients) return;
		const patient = todayPatients.find((item) => item.id === appointmentId);
		if (!patient || !canExaminePatient(patient)) {
			showToast('Hanya pasien yang sudah diperiksa perawat yang dapat dipilih dokter.', 'error');
			return;
		}

		if (selectedAppointmentId !== appointmentId) {
			if (
				activePatient &&
				(diagnosis.trim() || selectedMedicines.length > 0) &&
				!window.confirm('Ganti pasien? Draf diagnosis dan resep pasien aktif akan dihapus.')
			) {
				return;
			}
			diagnosis = '';
			searchQuery = '';
			selectedMedicines = [];
			selectedAppointmentId = appointmentId;
		}

		activeMenu = 'beranda';
		selectedSessionId = null;
		showToast(`${patient.patientName} dipilih untuk pemeriksaan. Status kunjungan tidak diubah.`);
	}

	async function handleFinishPatient() {
		if (isPatientActionPending || isRefreshingPatients) return;
		const patient = activePatient;
		if (!patient || !canExaminePatient(patient)) {
			showToast('Pasien harus berstatus Siap Diperiksa Dokter untuk diproses.', 'error');
			return;
		}

		const snapshot: Receipt = {
			patientName: patient.patientName,
			patientId: patient.patientId,
			doctorName: currentUser.name,
			date: todayDateDisplay,
			diagnosis: diagnosis.trim(),
			medicines: selectedMedicines.map((medicine) => ({ ...medicine }))
		};

		isFinishing = true;
		try {
			await doctorPracticeStore.updateAppointmentStatus(patient.id, 'DOCTOR_EXAMINED');
			receipt = snapshot;
			selectedAppointmentId = null;
			diagnosis = '';
			searchQuery = '';
			selectedMedicines = [];
			showToast('Pemeriksaan dokter selesai. Pasien selanjutnya menerima obat dari apoteker.');
		} catch (err) {
			showToast('Gagal menyelesaikan pemeriksaan:\n' + parseBackendError(err), 'error');
		} finally {
			isFinishing = false;
		}
	}

	function currentPatientState(patient: RegisteredPatient): RegisteredPatient {
		return todayPatients.find((item) => item.id === patient.id) || patient;
	}

	async function handleCancelPatient(patient: RegisteredPatient) {
		if (isPatientActionPending || isRefreshingPatients) return;

		const currentPatient = currentPatientState(patient);
		if (!canCancelPatient(currentPatient)) {
			showToast('Hanya kunjungan berstatus REGISTERED atau NURSE_CHECKED yang dapat dibatalkan.', 'error');
			return;
		}

		const draftWarning =
			selectedAppointmentId === currentPatient.id &&
			(diagnosis.trim() || selectedMedicines.length > 0)
				? '\nDraf diagnosis dan resep pasien ini akan dihapus setelah pembatalan berhasil.'
				: '';

		if (!window.confirm(`Batalkan kunjungan ${currentPatient.patientName}?${draftWarning}`)) return;

		cancellingAppointmentId = currentPatient.id;
		try {
			await doctorPracticeStore.updateAppointmentStatus(currentPatient.id, 'CANCELLED');
			if (selectedAppointmentId === currentPatient.id) {
				selectedAppointmentId = null;
				diagnosis = '';
				searchQuery = '';
				selectedMedicines = [];
			}
			showToast(`Kunjungan ${currentPatient.patientName} berhasil dibatalkan.`);
		} catch (err) {
			showToast('Gagal membatalkan kunjungan:\n' + parseBackendError(err), 'error');
		} finally {
			cancellingAppointmentId = null;
		}
	}

	async function refreshPatients() {
		if (isRefreshingPatients || isPatientActionPending) return;
		isRefreshingPatients = true;
		try {
			await Promise.all([
				doctorPracticeStore.fetchSchedules(),
				doctorPracticeStore.fetchTodayPatients(),
				doctorPracticeStore.fetchPatientHistory()
			]);
		} finally {
			isRefreshingPatients = false;
		}
	}

	let slotActionLoadingMap = $state<Record<string, boolean>>({});

	async function handleToggleSlotActive(slotId: string, isActive: boolean) {
		if (slotActionLoadingMap[slotId] || isPatientActionPending || isRefreshingPatients) return;
		slotActionLoadingMap[slotId] = true;
		try {
			await doctorPracticeStore.toggleSlotActive(slotId, isActive);
			showToast(isActive ? 'Slot praktik diaktifkan.' : 'Slot praktik dinonaktifkan.');
		} catch (err) {
			showToast(parseBackendError(err), 'error');
		} finally {
			slotActionLoadingMap[slotId] = false;
		}
	}

	async function handleUpdateSlotStatus(slotId: string, currentStatus: 'OPEN' | 'CLOSED') {
		if (slotActionLoadingMap[slotId] || isPatientActionPending || isRefreshingPatients) return;
		slotActionLoadingMap[slotId] = true;
		try {
			const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
			await doctorPracticeStore.updateSlotStatus(slotId, nextStatus);
			showToast(nextStatus === 'OPEN' ? 'Sesi praktik dibuka.' : 'Sesi praktik ditutup.');
		} catch (err) {
			showToast(parseBackendError(err), 'error');
		} finally {
			slotActionLoadingMap[slotId] = false;
		}
	}

	let selectedSessionId = $state<string | null>(null);
	let selectedSession = $derived(
		doctorPracticeStore.sessionCards.find((card) => card.id === selectedSessionId)
	);
	let selectedPatientRecordId = $state<string | null>(null);
	let selectedPatientRecord = $derived(
		doctorPracticeStore.examinedPatients.find(
			(patient) => patient.patientId === selectedPatientRecordId
		)
	);

	function openPatientRecordModal(patientId: string) {
		const found = doctorPracticeStore.examinedPatients.find(
			(patient) => patient.patientId === patientId
		);
		if (!found) {
			showToast('Belum ada riwayat rekam medis yang tersedia untuk pasien ini.', 'error');
			return;
		}
		selectedPatientRecordId = patientId;
	}

	let scheduleFormMode = $state<'single' | 'batch'>('batch');
	let targetScheduleDate = $state(localDateString(new Date()));
	let singleSlot = $state<SlotForm>({
		sessionName: 'Sesi Utama',
		startTime: '08:00',
		endTime: '10:00',
		quota: 10
	});

	function presetSlots(): SlotForm[] {
		return [
			{ sessionName: 'Sesi 1 (Pagi Awal)', startTime: '08:00', endTime: '10:00', quota: 10 },
			{ sessionName: 'Sesi 2 (Pagi Akhir)', startTime: '10:00', endTime: '12:00', quota: 10 },
			{ sessionName: 'Sesi 3 (Siang)', startTime: '13:00', endTime: '15:00', quota: 8 },
			{ sessionName: 'Sesi 4 (Sore)', startTime: '15:00', endTime: '17:00', quota: 8 },
			{ sessionName: 'Sesi 5 (Malam)', startTime: '18:00', endTime: '20:00', quota: 6 }
		];
	}

	let batchSlots = $state<SlotForm[]>(presetSlots());
	let isSavingSchedule = $state(false);

	function addBatchSlotRow() {
		batchSlots = [
			...batchSlots,
			{
				sessionName: `Sesi ${batchSlots.length + 1}`,
				startTime: '08:00',
				endTime: '10:00',
				quota: 10
			}
		];
	}

	function removeBatchSlotRow(index: number) {
		if (batchSlots.length > 1) {
			batchSlots = batchSlots.filter((_, itemIndex) => itemIndex !== index);
		}
	}

	async function handleSaveSchedule(event: SubmitEvent) {
		event.preventDefault();
		if (isSavingSchedule || isPatientActionPending || isRefreshingPatients) return;
		const selectedSlots = scheduleFormMode === 'single' ? [singleSlot] : batchSlots;
		if (
			selectedSlots.some(
				(slot) =>
					!slot.sessionName.trim() ||
					!slot.startTime ||
					!slot.endTime ||
					slot.endTime <= slot.startTime ||
					!Number.isInteger(Number(slot.quota)) ||
					Number(slot.quota) < 1 ||
					Number(slot.quota) > 100
			)
		) {
			showToast('Periksa nama sesi, waktu mulai/selesai, dan kuota (1–100 pasien).', 'error');
			return;
		}

		isSavingSchedule = true;
		try {
			const response = await doctorPracticeStore.createPracticeSchedule({
				practice_date: targetScheduleDate,
				slots: selectedSlots.map((slot) => ({
					name: slot.sessionName.trim(),
					start_hour: slot.startTime,
					end_hour: slot.endTime,
					status_slot: 'OPEN',
					is_active: true,
					max_patient: Number(slot.quota)
				}))
			});
			showToast(response.message || 'Jadwal praktik berhasil dibuat.');
		} catch (err) {
			showToast(parseBackendError(err), 'error');
		} finally {
			isSavingSchedule = false;
		}
	}

	function getSessionCardStatus(card: PracticeSessionCard): string {
		if (card.date < todayDateStr) return 'Selesai';
		if (card.date > todayDateStr) return 'Akan Datang';
		return 'Hari Ini';
	}

	let scheduleTabFilter = $state<'semua' | 'hari_ini' | 'akan_datang' | 'selesai'>('semua');
	let filteredSessionCards = $derived(
		doctorPracticeStore.sessionCards.filter((card) => {
			if (scheduleTabFilter === 'hari_ini') return card.date === todayDateStr;
			if (scheduleTabFilter === 'akan_datang') return card.date > todayDateStr;
			if (scheduleTabFilter === 'selesai') return card.date < todayDateStr;
			return true;
		})
	);

	let patientSearchQuery = $state('');
	let filteredPatientDatabase = $derived(
		doctorPracticeStore.examinedPatients.filter((patient) => {
			const query = patientSearchQuery.trim().toLowerCase();
			return [patient.name, patient.patientId, patient.primaryDiagnosis].some((value) =>
				value.toLowerCase().includes(query)
			);
		})
	);

	async function handlePatientSearch(event: SubmitEvent) {
		event.preventDefault();
		await doctorPracticeStore.fetchPatientHistory(patientSearchQuery);
	}

	let printMode = $state<'receipt' | 'record' | null>(null);

	async function printDocument(mode: 'receipt' | 'record') {
		if (mode === 'receipt' && !receipt) return;
		if (mode === 'record' && !selectedPatientRecord) return;
		printMode = mode;
		await tick();
		window.print();
		printMode = null;
	}

	function handleEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		selectedSessionId = null;
		selectedPatientRecordId = null;
		isSidebarOpen = false;
	}
</script>

<svelte:window onkeydown={handleEscape} />

<Title title="Dokter | Dashboard MedSync" />

{#snippet nurseDetails(assessment: NurseAssessment | null | undefined)}
	<div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-slate-800">
		<h4 class="font-bold text-emerald-900">Pemeriksaan Perawat</h4>
		{#if assessment}
			<dl class="mt-3 grid gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-xs text-slate-500">Tekanan Darah</dt>
					<dd>{assessment.sistolic ?? '-'} / {assessment.diastolic ?? '-'} mmHg</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-500">Denyut Nadi</dt>
					<dd>{assessment.heart_rate ?? '-'} bpm</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-500">Frekuensi Pernapasan</dt>
					<dd>{assessment.respiratory_rate ?? '-'} x/menit</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-500">Suhu</dt>
					<dd>{assessment.temperature ?? '-'} °C</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-500">Berat Badan</dt>
					<dd>{assessment.weight ?? '-'} kg</dd>
				</div>
				<div>
					<dt class="text-xs text-slate-500">Tinggi Badan</dt>
					<dd>{assessment.height ?? '-'} cm</dd>
				</div>
			</dl>
			<div class="mt-3 border-t border-emerald-200 pt-3">
				<p class="font-semibold text-emerald-900">Catatan Perawat</p>
				<p class="mt-1 whitespace-pre-wrap">{assessment.notes?.trim() || 'Belum ada catatan perawat.'}</p>
			</div>
		{:else}
			<p class="mt-2 text-slate-600">Data pemeriksaan perawat belum tersedia.</p>
		{/if}
	</div>
{/snippet}

{#snippet patientCard(patient: RegisteredPatient, allowSelection: boolean)}
	{@const currentPatient = currentPatientState(patient)}
	<div
		class="rounded-2xl border p-4 {activePatient?.id === currentPatient.id
			? 'border-sky-400 bg-sky-50'
			: 'border-slate-200 bg-white'}"
	>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<p class="font-bold text-slate-900">#{currentPatient.queueNumber} — {currentPatient.patientName}</p>
				<p class="mt-1 text-xs text-slate-500">
					No. RM: {currentPatient.patientId || '-'} · {currentPatient.timeSlot}
				</p>
				<p class="mt-1 text-xs text-slate-500">
					{currentPatient.gender} · {currentPatient.age ?? '-'} tahun · {currentPatient.phone}
				</p>
				<p class="mt-1 text-xs text-slate-500">
					Reservasi: {appointmentStatusLabel(currentPatient.appointmentStatus)}
				</p>
			</div>
			<span class="rounded-lg px-2.5 py-1 text-xs font-bold {statusClass(currentPatient.backendStatus)}">
				Kunjungan: {currentPatient.status}
			</span>
		</div>
		{#if activePatient?.id === currentPatient.id}
			<p class="mt-2 text-xs font-bold text-sky-700">Sedang dipilih untuk pemeriksaan dokter</p>
		{/if}
		{#if currentPatient.isUrgent}
			<p class="mt-2 text-xs font-bold text-rose-700">Pasien Prioritas</p>
		{/if}
		<div class="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
			<p><strong>Keluhan:</strong> {currentPatient.complaint || 'Belum tersedia.'}</p>
			<p class="mt-1 whitespace-pre-wrap text-slate-600">
				{currentPatient.detail_sympton || 'Rincian gejala belum tersedia.'}
			</p>
		</div>
		<details class="mt-3 text-sm">
			<summary class="cursor-pointer font-semibold text-emerald-800">
				Lihat pemeriksaan dan catatan perawat
			</summary>
			<div class="mt-2">{@render nurseDetails(currentPatient.nurseAssessment)}</div>
		</details>
		<div class="mt-3 flex flex-wrap justify-end gap-2">
			<button
				type="button"
				class="secondary-button"
				onclick={() => openPatientRecordModal(currentPatient.patientId)}
			>
				Rekam Medis
			</button>
			{#if canCancelPatient(currentPatient)}
				<button
					type="button"
					class="danger-button"
					disabled={isPatientActionPending || isRefreshingPatients}
					onclick={() => handleCancelPatient(currentPatient)}
				>
					{cancellingAppointmentId === currentPatient.id ? 'Membatalkan...' : 'Batalkan Kunjungan'}
				</button>
			{/if}
			{#if canExaminePatient(currentPatient) && allowSelection}
				<button
					type="button"
					class="primary-button"
					disabled={isPatientActionPending || isRefreshingPatients}
					onclick={() => handleCallPatient(currentPatient.id)}
				>
					{activePatient?.id === currentPatient.id ? 'Lanjutkan Pemeriksaan' : 'Panggil ke Ruang Periksa'}
				</button>
			{:else}
				<p class="self-center text-xs text-slate-500">
					{currentPatient.backendStatus === 'REGISTERED'
						? 'Menunggu pemeriksaan perawat.'
						: currentPatient.backendStatus === 'DOCTOR_EXAMINED'
							? 'Pemeriksaan dokter selesai; menunggu proses apotek.'
							: currentPatient.backendStatus === 'COMPLETED'
								? 'Kunjungan telah selesai.'
								: currentPatient.backendStatus === 'CANCELLED'
									? 'Kunjungan dibatalkan.'
									: canExaminePatient(currentPatient)
										? 'Pilih pasien melalui antrean hari ini setelah memperbarui data.'
										: 'Status kunjungan tidak dapat diproses.'}
				</p>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet receiptContent()}
	{#if receipt}
		<div class="receipt-card rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
			<div class="border-b border-dashed border-slate-300 pb-3 text-center">
				<h3 class="font-black tracking-widest">MEDSYNC</h3>
				<p class="text-xs">Resep Dokter Digital</p>
				<p class="mt-1 text-xs">{receipt.date}</p>
			</div>
			<div class="mt-3 space-y-1 text-sm">
				<p><strong>Pasien:</strong> {receipt.patientName}</p>
				<p><strong>No. RM:</strong> {receipt.patientId || '-'}</p>
				<p><strong>Dokter:</strong> dr. {receipt.doctorName}</p>
				<p class="whitespace-pre-wrap"><strong>Diagnosis:</strong> {receipt.diagnosis || 'Belum diisi.'}</p>
			</div>
			<h4 class="mt-4 border-t border-dashed border-slate-300 pt-3 font-bold">Daftar Obat</h4>
			<ul class="mt-2 space-y-3 text-sm">
				{#each receipt.medicines as medicine (medicine.name)}
					<li>
						<p class="font-semibold">{medicine.name}</p>
						<p>{medicine.usage || 'Aturan pakai belum diisi.'}</p>
					</li>
				{:else}
					<li>Tidak ada obat yang dipilih.</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#snippet medicalRecordContent()}
	{#if selectedPatientRecord}
		<div class="space-y-5">
			<div class="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm">
				<p class="font-bold">Rekam Medis dr. {currentUser.name}</p>
				<p>{selectedPatientRecord.name} · No. RM: {selectedPatientRecord.patientId}</p>
				<p>
					{selectedPatientRecord.gender} · {selectedPatientRecord.age ?? '-'} tahun ·
					{selectedPatientRecord.phone}
				</p>
				<p>{selectedPatientRecord.address}</p>
				<p class="mt-2">{selectedPatientRecord.histories.length} catatan medis</p>
			</div>
			{#each selectedPatientRecord.histories as record (record.id)}
				<article class="record-card overflow-hidden rounded-2xl border border-slate-200 bg-white">
					<header class="flex flex-wrap justify-between gap-3 bg-slate-100 p-4">
						<div>
							<h3 class="font-bold">{record.patient_name}</h3>
							<p class="text-xs text-slate-600">
								{record.gender} · {record.patient_age ?? '-'} tahun
							</p>
							<p class="mt-1 text-sm">{record.visitDate}</p>
							<p class="text-xs text-slate-500">{record.sessionType}</p>
							<p class="mt-1 text-xs text-slate-500">
								Reservasi: {appointmentStatusLabel(record.appointmentStatus)}
							</p>
						</div>
						<span class="h-fit rounded-lg px-3 py-1 text-xs font-bold {statusClass(record.backendStatus)}">
							Kunjungan: {record.status}
						</span>
					</header>
					<div class="space-y-4 p-4 text-sm">
						<div class="rounded-xl bg-amber-50 p-3">
							<h4 class="font-bold">Keluhan Utama Pasien</h4>
							<p class="mt-1 whitespace-pre-wrap">{record.complaint || 'Belum diisi.'}</p>
							<p class="mt-2 whitespace-pre-wrap text-slate-600">
								{record.detail_sympton || 'Rincian gejala belum tersedia.'}
							</p>
						</div>

						{@render nurseDetails(record.nurseAssessment)}

						{#if record.backendStatus === 'DOCTOR_EXAMINED' || record.backendStatus === 'COMPLETED' || record.doctorAssessment}
							<div class="rounded-xl border border-sky-100 bg-sky-50 p-4">
								<h4 class="font-bold text-sky-900">SOAP Pemeriksaan Dokter</h4>
								<div class="mt-2 space-y-2 whitespace-pre-wrap">
									<p><strong>Subjective:</strong> {record.complaint || 'Belum diisi.'}</p>
									<p><strong>Objective:</strong> {record.doctorAssessment?.objective || 'Belum diisi.'}</p>
									<p><strong>Assessment:</strong> {record.doctorAssessment?.assesment || record.diagnosis}</p>
									<p><strong>Plan:</strong> {record.doctorAssessment?.plan || 'Belum diisi.'}</p>
									<p><strong>Catatan Dokter:</strong> {record.doctorAssessment?.notes || record.doctorNotes || 'Belum diisi.'}</p>
								</div>
							</div>
						{:else}
							<p class="text-slate-500">Pemeriksaan dokter belum selesai.</p>
						{/if}

						{#if record.prescription.length}
							<div class="rounded-xl bg-slate-50 p-3">
								<h4 class="font-bold">Resep Obat ({record.prescription.length})</h4>
								<ul class="mt-2 space-y-2">
									{#each record.prescription as medicine, index (index)}
										<li class="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
											<span class="font-semibold">{medicine.name}</span>
											<span>{medicine.rules_using}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
{/snippet}

<div class="screen-layout flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if !isForbidden}
		<Sidebar
			role="dokter"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(menu) => (activeMenu = menu)}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if toastNotification}
			<div
				role="status"
				class="fixed top-5 right-5 z-[70] max-w-md rounded-2xl border p-4 shadow-xl {toastNotification.type === 'success'
					? 'border-emerald-200 bg-emerald-950 text-emerald-50'
					: 'border-rose-200 bg-rose-950 text-rose-50'}"
			>
				<div class="flex items-start gap-4">
					<p class="text-sm whitespace-pre-line">{toastNotification.message}</p>
					<button type="button" aria-label="Tutup pemberitahuan" onclick={() => (toastNotification = null)}>
						✕
					</button>
				</div>
			</div>
		{/if}

		{#if !isForbidden}
			<header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:hidden">
				<button
					type="button"
					aria-label="Buka menu navigasi"
					class="font-bold text-sky-700"
					onclick={() => (isSidebarOpen = true)}
				>
					☰ Menu
				</button>
				<span class="text-xs font-bold">ID: {currentUser.user_code || currentUser.id}</span>
			</header>
		{/if}

		<div class="flex-1 overflow-y-auto p-5 md:p-8">
			{#if isLoading}
				<DashboardSkeletonDokter />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<section class="mb-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-6 text-white shadow-lg sm:p-8">
					<div class="flex flex-wrap items-center justify-between gap-5">
						<div>
							<p class="text-xs font-bold tracking-wider text-sky-200 uppercase">{todayDateDisplay}</p>
							<h1 class="mt-3 text-3xl font-black">Halo, dr. {currentUser.name || 'Dokter'}! 🩺</h1>
							<p class="mt-2 text-sm text-slate-300">
								{todayStats.ready} pasien siap diperiksa dokter dari {todayStats.total} kunjungan hari ini.
							</p>
						</div>
						<div class="rounded-2xl bg-white/10 p-4">
							<p class="text-xs text-slate-300">SIP / ID Dokter</p>
							<p class="font-bold">{currentUser.user_code || currentUser.id}</p>
						</div>
					</div>
				</section>

				{#if doctorPracticeStore.error}
					<div role="alert" class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
						<p>Data mungkin belum diperbarui: {doctorPracticeStore.error}</p>
						<button
							type="button"
							class="mt-2 font-bold underline"
							disabled={isRefreshingPatients || isPatientActionPending}
							onclick={refreshPatients}
						>
							Coba perbarui data
						</button>
					</div>
				{/if}

				{#if activeMenu === 'beranda'}
					<section class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
						{#each [
							{ label: 'Pasien Hari Ini', count: todayStats.total },
							{ label: 'Siap Diperiksa Dokter', count: todayStats.ready },
							{ label: 'Menunggu Perawat', count: todayStats.waitingNurse },
							{ label: 'Selesai Diperiksa Dokter', count: todayStats.examined },
							{ label: 'Kunjungan Dibatalkan', count: todayStats.cancelled },
							{ label: 'Kunjungan Selesai', count: todayStats.completed }
						] as statistic (statistic.label)}
							<div class="rounded-2xl border border-slate-200 bg-white p-4">
								<p class="text-xs font-semibold text-slate-600">{statistic.label}</p>
								<p class="mt-2 text-3xl font-black text-sky-800">{statistic.count}</p>
							</div>
						{/each}
					</section>

					<div class="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
						Dokter hanya dapat memeriksa pasien dengan status kunjungan
						<strong>Siap Diperiksa Dokter</strong>.
						Memilih pasien tidak mengubah status reservasi maupun kunjungan.
						Setelah pemeriksaan diselesaikan, status kunjungan berubah menjadi
						<strong>Selesai Diperiksa Dokter</strong>.
						Pembatalan hanya tersedia untuk kunjungan berstatus
						<strong>REGISTERED</strong> atau <strong>NURSE_CHECKED</strong>.
					</div>

					{#if selectedAppointmentId && !activePatient}
						<div role="alert" class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
							Pasien yang sebelumnya dipilih tidak lagi tersedia atau tidak lagi berstatus Siap Diperiksa Dokter.
							Pemeriksaan dinonaktifkan. Pilih pasien yang memenuhi syarat dari antrean.
						</div>
					{/if}

					<div class="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
						<div class="space-y-6">
							{#if activePatient}
								<section class="rounded-3xl border border-sky-200 bg-white p-5 sm:p-6">
									<p class="text-xs font-bold tracking-wide text-sky-700 uppercase">
										Pasien Dipilih · Antrean #{activePatient.queueNumber}
									</p>
									<h2 class="mt-2 text-2xl font-black">{activePatient.patientName}</h2>
									<p class="mt-1 text-sm text-slate-500">
										No. RM: {activePatient.patientId || '-'} · {activePatient.gender} ·
										{activePatient.age ?? '-'} tahun
									</p>
									<p class="mt-1 text-sm text-slate-500">
										{activePatient.phone} · {activePatient.timeSlot}
									</p>
									<div class="my-4 rounded-xl bg-amber-50 p-4 text-sm">
										<p class="font-bold">Keluhan Utama</p>
										<p class="mt-1 whitespace-pre-wrap">{activePatient.complaint || 'Belum tersedia.'}</p>
										<p class="mt-2 whitespace-pre-wrap text-slate-600">{activePatient.detail_sympton || 'Rincian gejala belum tersedia.'}</p>
									</div>
									{@render nurseDetails(activePatient.nurseAssessment)}
									<button
										type="button"
										class="secondary-button mt-4"
										onclick={() => openPatientRecordModal(activePatient.patientId)}
									>
										Buka Rekam Medis Pasien
									</button>
								</section>
							{:else}
								<section class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
									<h2 class="font-bold">Belum ada pasien yang dipilih</h2>
									<p class="mt-2 text-sm text-slate-500">
										Pilih “Panggil ke Ruang Periksa” pada pasien berstatus Siap Diperiksa Dokter.
									</p>
								</section>
							{/if}

							<section class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
								<h2 class="text-xl font-bold">Resep & Tindakan Medis</h2>
								<p class="mt-1 text-xs text-slate-500">
									{activePatient ? `Pasien: ${activePatient.patientName}` : 'Pilih pasien terlebih dahulu.'}
								</p>
								<form
									class="mt-5"
									onsubmit={(event) => {
										event.preventDefault();
										void handleFinishPatient();
									}}
								>
									<fieldset disabled={!activePatient || isPatientActionPending || isRefreshingPatients} class="space-y-4 disabled:opacity-50">
										<label class="field-label">
											Hasil Diagnosis Dokter
											<textarea
												bind:value={diagnosis}
												rows="3"
												class="field-input"
												placeholder="Tuliskan hasil diagnosis"
											></textarea>
										</label>
										<label class="field-label">
											Cari Obat (Katalog Apotek RS)
											<input bind:value={searchQuery} class="field-input" placeholder="Nama obat atau kategori" />
										</label>
										<div class="max-h-80 space-y-3 overflow-y-auto">
											{#each filteredMedicines as medicine (medicine.name)}
												<div class="rounded-xl border border-slate-200 p-3">
													<div class="flex items-center justify-between gap-3">
														<div>
															<p class="text-sm font-bold">{medicine.name}</p>
															<p class="text-xs text-slate-500">{medicine.category} · {medicine.notes}</p>
														</div>
														<button
															type="button"
															class="secondary-button"
															onclick={() => toggleMedicine(medicine.name)}
														>
															{selectedMedicines.some((item) => item.name === medicine.name) ? 'Batalkan' : '+ Resepkan'}
														</button>
													</div>
													{#if selectedMedicines.some((item) => item.name === medicine.name)}
														<label class="field-label mt-3">
															Aturan pakai {medicine.name}
															<input
																class="field-input"
																placeholder="Tuliskan aturan pakai"
																value={selectedMedicines.find((item) => item.name === medicine.name)?.usage ?? ''}
																oninput={(event) => updateMedicineUsage(medicine.name, event.currentTarget.value)}
															/>
														</label>
													{/if}
												</div>
											{:else}
												<p class="text-sm text-slate-500">Tidak ada obat yang sesuai.</p>
											{/each}
										</div>
										<p class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
											Diagnosis dan pilihan obat di formulir ini hanya digunakan untuk pratinjau cetak.
											Penyimpanan ke server saat ini hanya mengubah status pemeriksaan.
										</p>
										<button type="submit" class="primary-button w-full">
											{isFinishing ? 'Menyimpan Pemeriksaan...' : 'Selesai Pemeriksaan & Siapkan Resep Digital'}
										</button>
									</fieldset>
								</form>
							</section>
						</div>

						<aside class="space-y-6">
							<section class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
								<div class="mb-4 flex items-center justify-between gap-3">
									<div>
										<h2 class="text-lg font-bold">Pasien Hari Ini · Semua Status</h2>
										<p class="mt-1 text-xs text-slate-500">
											Siap diperiksa → Menunggu perawat → Selesai diperiksa →
											Dibatalkan → Kunjungan selesai
										</p>
									</div>
									<button
										type="button"
										class="secondary-button"
										disabled={isRefreshingPatients || isPatientActionPending}
										onclick={refreshPatients}
									>
										{isRefreshingPatients ? 'Memperbarui...' : 'Perbarui'}
									</button>
								</div>
								<div class="max-h-[700px] space-y-3 overflow-y-auto">
									{#each todayPatients as patient (patient.id)}
										{@render patientCard(patient, true)}
									{:else}
										<p class="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
											Belum ada pasien untuk hari ini.
										</p>
									{/each}
								</div>
							</section>

							<section class="rounded-3xl bg-slate-900 p-5 text-white sm:p-6">
								<div class="mb-4 flex items-center justify-between gap-3">
									<div>
										<h2 class="text-lg font-bold">Struk Digital Resep</h2>
										<p class="text-xs text-slate-400">Pemeriksaan terakhir yang diselesaikan</p>
									</div>
									{#if receipt}
										<button type="button" class="primary-button" onclick={() => printDocument('receipt')}>
											Print PDF
										</button>
									{/if}
								</div>
								{#if receipt}
									{@render receiptContent()}
								{:else}
									<p class="rounded-xl border border-dashed border-slate-600 p-8 text-center text-sm text-slate-400">
										Selesaikan pemeriksaan untuk menyiapkan struk resep digital.
									</p>
								{/if}
							</section>
						</aside>
					</div>
				{:else if activeMenu === 'jadwal'}
					<div class="space-y-6">
						<section class="rounded-3xl border border-slate-200 bg-white p-6">
							<h2 class="text-2xl font-black">Jadwal Praktik Dokter</h2>
							<p class="mt-1 text-sm text-slate-500">Kelola sesi praktik dan pantau pasien yang mendaftar.</p>
							<div class="mt-4 flex flex-wrap gap-2">
								<button type="button" class={scheduleTabFilter === 'semua' ? 'primary-button' : 'secondary-button'} onclick={() => (scheduleTabFilter = 'semua')}>
									Semua ({doctorPracticeStore.sessionCards.length})
								</button>
								<button type="button" class={scheduleTabFilter === 'hari_ini' ? 'primary-button' : 'secondary-button'} onclick={() => (scheduleTabFilter = 'hari_ini')}>
									Hari Ini ({doctorPracticeStore.sessionCards.filter((card) => card.date === todayDateStr).length})
								</button>
								<button type="button" class={scheduleTabFilter === 'akan_datang' ? 'primary-button' : 'secondary-button'} onclick={() => (scheduleTabFilter = 'akan_datang')}>
									Akan Datang ({doctorPracticeStore.sessionCards.filter((card) => card.date > todayDateStr).length})
								</button>
								<button type="button" class={scheduleTabFilter === 'selesai' ? 'primary-button' : 'secondary-button'} onclick={() => (scheduleTabFilter = 'selesai')}>
									Selesai ({doctorPracticeStore.sessionCards.filter((card) => card.date < todayDateStr).length})
								</button>
							</div>
						</section>

						<div class="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
							<section class="space-y-4">
								{#each filteredSessionCards as card (card.id)}
									<div class="rounded-3xl border border-slate-200 bg-white p-5">
										<div class="flex flex-wrap gap-2 text-xs font-bold">
											<span class="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{getSessionCardStatus(card)}</span>
											<span class="rounded-full px-3 py-1 {card.isFull || card.status_slot === 'CLOSED' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
												{card.isFull ? 'Kuota Penuh' : card.status_slot === 'OPEN' ? 'Terbuka' : 'Ditutup'}
											</span>
											<span class="rounded-full bg-slate-100 px-3 py-1">{card.is_active ? 'Aktif' : 'Nonaktif'}</span>
										</div>
										<h3 class="mt-3 text-xl font-bold">{card.sessionName}</h3>
										<p class="mt-1 text-sm text-slate-500">{card.dateDisplay}</p>
										<p class="mt-1 text-sm">{card.startTime} – {card.endTime} WIB · Ruang: {card.room}</p>
										<p class="mt-3 text-xs font-bold">Terisi: {card.current_patient_count} / {card.quota} pasien</p>
										<div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
											<div
												class="h-full bg-sky-600"
												style:width={`${card.quota > 0 ? Math.min(100, (card.current_patient_count / card.quota) * 100) : 0}%`}
											></div>
										</div>
										<div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
											<button
												type="button"
												class="secondary-button"
												disabled={slotActionLoadingMap[card.slotId] || isPatientActionPending || isRefreshingPatients}
												onclick={() => handleUpdateSlotStatus(card.slotId, card.status_slot)}
											>
												{card.status_slot === 'OPEN' ? 'Tutup Sesi' : 'Buka Sesi'}
											</button>
											<button
												type="button"
												class="secondary-button"
												disabled={slotActionLoadingMap[card.slotId] || isPatientActionPending || isRefreshingPatients}
												onclick={() => handleToggleSlotActive(card.slotId, !card.is_active)}
											>
												{card.is_active ? 'Nonaktifkan Sesi' : 'Aktifkan Sesi'}
											</button>
											<button type="button" class="primary-button" onclick={() => (selectedSessionId = card.id)}>
												Lihat Pasien ({card.patients.length})
											</button>
										</div>
									</div>
								{:else}
									<p class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
										Belum ada sesi praktik pada filter ini.
									</p>
								{/each}
							</section>

							<aside class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
								<h3 class="text-xl font-bold">Buat Slot Jadwal Praktik</h3>
								<div class="my-4 flex gap-2">
									<button type="button" class={scheduleFormMode === 'batch' ? 'primary-button' : 'secondary-button'} disabled={isSavingSchedule || isPatientActionPending || isRefreshingPatients} onclick={() => (scheduleFormMode = 'batch')}>
										Multi-Slot
									</button>
									<button type="button" class={scheduleFormMode === 'single' ? 'primary-button' : 'secondary-button'} disabled={isSavingSchedule || isPatientActionPending || isRefreshingPatients} onclick={() => (scheduleFormMode = 'single')}>
										Single Slot
									</button>
								</div>
								<form onsubmit={handleSaveSchedule}>
									<fieldset disabled={isSavingSchedule || isPatientActionPending || isRefreshingPatients} class="space-y-4">
										<label class="field-label">
											Tanggal Praktik
											<input type="date" bind:value={targetScheduleDate} required class="field-input" />
										</label>
										{#if scheduleFormMode === 'batch'}
											<button type="button" class="secondary-button" onclick={() => (batchSlots = presetSlots())}>
												Isi 5 Sesi Standar
											</button>
											<div class="max-h-[450px] space-y-3 overflow-y-auto">
												{#each batchSlots as slot, index (index)}
													<div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
														<div class="flex items-center justify-between">
															<p class="text-sm font-bold">Slot #{index + 1}</p>
															{#if batchSlots.length > 1}
																<button type="button" class="text-xs font-bold text-rose-700" onclick={() => removeBatchSlotRow(index)}>
																	Hapus
																</button>
															{/if}
														</div>
														<label class="field-label">
															Nama Sesi
															<input bind:value={slot.sessionName} required class="field-input" />
														</label>
														<div class="grid grid-cols-2 gap-2">
															<label class="field-label">
																Mulai
																<input type="time" bind:value={slot.startTime} required class="field-input" />
															</label>
															<label class="field-label">
																Selesai
																<input type="time" bind:value={slot.endTime} required class="field-input" />
															</label>
														</div>
														<label class="field-label">
															Kuota
															<input type="number" min="1" max="100" step="1" bind:value={slot.quota} required class="field-input" />
														</label>
													</div>
												{/each}
											</div>
											<button type="button" class="secondary-button w-full" onclick={addBatchSlotRow}>
												+ Tambah Baris Slot
											</button>
										{:else}
											<label class="field-label">
												Nama Sesi
												<input bind:value={singleSlot.sessionName} required class="field-input" />
											</label>
											<div class="grid grid-cols-2 gap-3">
												<label class="field-label">
													Jam Mulai
													<input type="time" bind:value={singleSlot.startTime} required class="field-input" />
												</label>
												<label class="field-label">
													Jam Selesai
													<input type="time" bind:value={singleSlot.endTime} required class="field-input" />
												</label>
											</div>
											<label class="field-label">
												Kuota Pasien
												<input type="number" min="1" max="100" step="1" bind:value={singleSlot.quota} required class="field-input" />
											</label>
										{/if}
										<button type="submit" class="primary-button w-full">
											{isSavingSchedule ? 'Menyimpan...' : scheduleFormMode === 'batch' ? `Buka ${batchSlots.length} Slot Jadwal` : 'Buka Slot Jadwal'}
										</button>
									</fieldset>
								</form>
							</aside>
						</div>
					</div>
				{:else if activeMenu === 'pasien'}
					<section class="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
						<h2 class="text-2xl font-black">Daftar Pasien dr. {currentUser.name}</h2>
						<p class="mt-1 text-sm text-slate-500">
							{doctorPracticeStore.examinedPatients.length} pasien · Riwayat pemeriksaan yang tersedia
						</p>
						<form onsubmit={handlePatientSearch} class="mt-4 flex items-end gap-3">
							<label class="field-label flex-1">
								Cari Pasien
								<input bind:value={patientSearchQuery} class="field-input" placeholder="Nama, nomor RM, atau diagnosis" />
							</label>
							<button type="submit" class="primary-button">Cari di Server</button>
						</form>
					</section>
					<div class="grid gap-5 md:grid-cols-2">
						{#each filteredPatientDatabase as patient (patient.patientId)}
							<article class="rounded-3xl border border-slate-200 bg-white p-6">
								<div class="flex flex-wrap justify-between gap-2 text-xs font-bold">
									<span class="text-sky-700">No. RM: {patient.patientId}</span>
									<span>{patient.totalVisits} kunjungan</span>
								</div>
								<h3 class="mt-3 text-xl font-black">{patient.name}</h3>
								<p class="mt-1 text-sm text-slate-500">{patient.gender} · {patient.age ?? '-'} tahun · {patient.phone}</p>
								<p class="mt-2 text-sm text-slate-500">{patient.address}</p>
								<div class="my-4 rounded-xl bg-slate-50 p-3 text-sm">
									<p class="text-xs text-slate-500">Diagnosis Terakhir ({patient.lastVisitDate})</p>
									<p class="mt-1 font-semibold">{patient.primaryDiagnosis}</p>
								</div>
								<button type="button" class="primary-button" onclick={() => openPatientRecordModal(patient.patientId)}>
									Buka Rekam Medis
								</button>
							</article>
						{:else}
							<p class="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
								Tidak ada data pasien yang sesuai.
							</p>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>

{#if selectedSession}
	<div class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
		<section
			role="dialog"
			aria-modal="true"
			aria-labelledby="session-dialog-title"
			tabindex="-1"
			class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
		>
			<header class="flex items-start justify-between gap-4 bg-slate-900 p-5 text-white">
				<div>
					<h2 id="session-dialog-title" class="text-xl font-bold">{selectedSession.sessionName}</h2>
					<p class="mt-1 text-sm">{selectedSession.dateDisplay}</p>
					<p class="text-xs text-slate-300">
						{selectedSession.startTime} – {selectedSession.endTime} WIB ·
						{selectedSession.patients.length} / {selectedSession.quota} pasien
					</p>
				</div>
				<button type="button" aria-label="Tutup daftar pasien" onclick={() => (selectedSessionId = null)}>✕</button>
			</header>
			<div class="flex-1 space-y-3 overflow-y-auto p-5">
				{#each selectedSession.patients as patient (patient.id)}
					{@render patientCard(
						patient,
						selectedSession.date === todayDateStr &&
							todayPatients.some((item) => item.id === patient.id && canExaminePatient(item))
					)}
				{:else}
					<p class="p-8 text-center text-sm text-slate-500">Belum ada pasien pada sesi ini.</p>
				{/each}
			</div>
			<footer class="flex justify-end border-t border-slate-100 p-4">
				<button type="button" class="primary-button" onclick={() => (selectedSessionId = null)}>Tutup</button>
			</footer>
		</section>
	</div>
{/if}

{#if selectedPatientRecord}
	<div class="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
		<section
			role="dialog"
			aria-modal="true"
			aria-labelledby="record-dialog-title"
			tabindex="-1"
			class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
		>
			<header class="flex items-center justify-between gap-4 bg-slate-900 p-5 text-white">
				<div>
					<h2 id="record-dialog-title" class="text-xl font-bold">Rekam Medis: {selectedPatientRecord.name}</h2>
					<p class="mt-1 text-xs text-slate-300">No. RM: {selectedPatientRecord.patientId}</p>
				</div>
				<button type="button" aria-label="Tutup rekam medis" onclick={() => (selectedPatientRecordId = null)}>✕</button>
			</header>
			<div class="flex-1 overflow-y-auto bg-slate-50 p-5">
				{@render medicalRecordContent()}
			</div>
			<footer class="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
				<button type="button" class="secondary-button" onclick={() => printDocument('record')}>Cetak Rekam Medis</button>
				<button type="button" class="primary-button" onclick={() => (selectedPatientRecordId = null)}>Tutup</button>
			</footer>
		</section>
	</div>
{/if}

{#if printMode}
	<div class="print-document" class:receipt-document={printMode === 'receipt'}>
		{#if printMode === 'receipt'}
			{@render receiptContent()}
		{:else}
			{@render medicalRecordContent()}
		{/if}
	</div>
{/if}

<style>
	.field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #334155;
	}

	.field-input {
		display: block;
		width: 100%;
		min-width: 0;
		margin-top: 0.375rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.75rem;
		background: white;
		padding: 0.625rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 400;
		color: #0f172a;
	}

	.field-input:focus {
		outline: 2px solid #bae6fd;
		outline-offset: 1px;
		border-color: #0284c7;
	}

	.primary-button,
	.secondary-button,
	.danger-button {
		border-radius: 0.75rem;
		padding: 0.625rem 0.875rem;
		font-size: 0.75rem;
		font-weight: 700;
		transition: background-color 150ms;
	}

	.primary-button {
		border: 1px solid transparent;
		background: #0f172a;
		color: white;
	}

	.primary-button:hover:not(:disabled) {
		background: #0369a1;
	}

	.secondary-button {
		border: 1px solid #cbd5e1;
		background: white;
		color: #334155;
	}

	.secondary-button:hover:not(:disabled) {
		background: #f1f5f9;
	}

	.danger-button {
		border: 1px solid #fecdd3;
		background: #fff1f2;
		color: #be123c;
	}

	.danger-button:hover:not(:disabled) {
		background: #ffe4e6;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.receipt-card {
		font-family: 'Courier New', Courier, monospace;
	}

	.print-document {
		display: none;
	}

	@media print {
		@page {
			size: auto;
			margin: 12mm;
		}

		:global(body) {
			background: white !important;
		}

		.screen-layout,
		.modal-overlay {
			display: none !important;
		}

		.print-document {
			display: block;
			color: #0f172a;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		.receipt-document {
			width: 80mm;
			max-width: 100%;
			margin: 0 auto;
		}

		.record-card {
			break-inside: avoid;
		}
	}
</style>
