<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonDokter from '$lib/components/skeleton/DashboardSkeletonDokter.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import {
		doctorPracticeStore,
		type DoctorSchedule,
		type PracticeSessionCard,
		type RegisteredPatient,
		type DoctorExaminedPatient
	} from '$lib/stores/doctorPractice.svelte';

	type DashboardUser = { role: string; name: string; id: string; user_code?: string };

	let isLoading = $state(true);
	let isForbidden = $state(false);

	let currentUser = $state<DashboardUser>({ role: 'dokter', name: '', id: '', user_code: '' });
	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	const todayDateStr = new Date().toISOString().split('T')[0];
	const todayDateDisplay = new Date().toLocaleDateString('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	// =========================================================================
	// INITIALIZATION & STORE DATA FETCHING
	// =========================================================================

	onMount(async () => {
		try {
			const profile = await validateSession();

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
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});

	// Derived reactive states based on store single source of truth
	function getScheduleStatus(sched: DoctorSchedule): 'Dimulai' | 'Akan Datang' | 'Selesai' {
		if (sched.date < todayDateStr) return 'Selesai';
		if (sched.date > todayDateStr) return 'Akan Datang';
		return 'Dimulai';
	}

	let todaySchedules = $derived(
		doctorPracticeStore.schedules.filter((s: DoctorSchedule) => s.date === todayDateStr)
	);

	let todayPatients = $derived(
		doctorPracticeStore.todayPatients.length > 0
			? doctorPracticeStore.todayPatients
			: todaySchedules.flatMap((s: DoctorSchedule) => s.patients)
	);

	let activePatient = $derived(
		todayPatients.find((p: RegisteredPatient) => p.status === 'Sedang Diperiksa') ||
			todayPatients[0]
	);

	let todayStats = $derived({
		total: todayPatients.length,
		finished: todayPatients.filter((p: RegisteredPatient) => p.status === 'Selesai').length,
		waiting: todayPatients.filter((p: RegisteredPatient) => p.status === 'Menunggu').length,
		examining: todayPatients.filter((p: RegisteredPatient) => p.status === 'Sedang Diperiksa')
			.length
	});

	// --- FORM RESEP & KATALOG OBAT ---
	let diagnosis = $state('Hasil Pemeriksaan Medis');
	let searchQuery = $state('');
	let selectedMedicines = $state<Array<{ name: string; usage: string }>>([]);
	let receiptVisible = $state(false);

	const medicineCatalog = [
		{ name: 'Paracetamol 500mg', category: 'Analgesik', notes: 'Penurun demam & pereda nyeri' },
		{ name: 'Amoxicillin 500mg', category: 'Antibiotik', notes: 'Infeksi bakteri ringan-sedang' },
		{ name: 'Omeprazole 20mg', category: 'Pencernaan', notes: 'Menurunkan asam lambung' },
		{ name: 'Isosorbide Dinitrate 5mg', category: 'Jantung', notes: 'Nyeri dada angina' },
		{ name: 'Cetirizine 10mg', category: 'Antihistamin', notes: 'Alergi & gatal' },
		{ name: 'Vitamin C 500mg', category: 'Suplemen', notes: 'Daya tahan tubuh' }
	];

	let filteredMedicines = $derived(
		medicineCatalog.filter((med) => {
			const q = searchQuery.toLowerCase();
			return (
				med.name.toLowerCase().includes(q) ||
				med.category.toLowerCase().includes(q) ||
				med.notes.toLowerCase().includes(q)
			);
		})
	);

	function toggleMedicine(name: string) {
		const existing = selectedMedicines.find((item) => item.name === name);
		if (existing) selectedMedicines = selectedMedicines.filter((item) => item.name !== name);
		else selectedMedicines = [...selectedMedicines, { name, usage: '3x1 Tablet Setelah Makan' }];
	}

	function updateMedicineUsage(name: string, usage: string) {
		selectedMedicines = selectedMedicines.map((item) =>
			item.name === name ? { ...item, usage } : item
		);
	}

	function printReceipt() {
		receiptVisible = true;
		setTimeout(() => window.print(), 150);
	}

	// --- TOAST NOTIFICATIONS & FEEDBACK ---
	let toastNotification = $state<{ type: 'success' | 'error'; message: string } | null>(null);
	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toastNotification = { type, message };
		setTimeout(() => {
			if (toastNotification?.message === message) {
				toastNotification = null;
			}
		}, 6000);
	}

	// --- STORE ACTIONS FOR APPOINTMENT STATUS & SLOTS DENGAN PROTEKSI SPAM ---
	let slotActionLoadingMap = $state<Record<string, boolean>>({});

	async function handleCallPatient(appointmentId: string) {
		try {
			await doctorPracticeStore.updateAppointmentStatus(appointmentId, 'CONFIRMED');
			showToast('Pasien berhasil dipanggil ke ruang pemeriksaan!', 'success');
		} catch (err: any) {
			showToast('Gagal memanggil pasien:\n' + err.message, 'error');
		}
	}

	async function handleFinishPatient(appointmentId: string) {
		try {
			await doctorPracticeStore.updateAppointmentStatus(appointmentId, 'COMPLETED');
			receiptVisible = true;
			showToast('Pemeriksaan pasien berhasil diselesaikan!', 'success');
		} catch (err: any) {
			showToast('Gagal menyelesaikan pemeriksaan:\n' + err.message, 'error');
		}
	}

	async function handleToggleSlotActive(slotId: string, isActive: boolean) {
		const key = `active_${slotId}`;
		if (slotActionLoadingMap[key]) return;
		slotActionLoadingMap[key] = true;

		try {
			await doctorPracticeStore.toggleSlotActive(slotId, isActive);
			showToast(
				isActive ? 'Slot praktik berhasil diaktifkan!' : 'Slot praktik dinonaktifkan.',
				'success'
			);
		} catch (err: any) {
			showToast('Gagal mengubah status aktif slot:\n' + err.message, 'error');
		} finally {
			slotActionLoadingMap[key] = false;
		}
	}

	async function handleUpdateSlotStatus(slotId: string, currentStatus: 'OPEN' | 'CLOSED') {
		const key = `status_${slotId}`;
		if (slotActionLoadingMap[key]) return;
		slotActionLoadingMap[key] = true;

		try {
			const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
			await doctorPracticeStore.updateSlotStatus(slotId, nextStatus);
			showToast(
				`Status slot berhasil diubah menjadi ${nextStatus === 'OPEN' ? 'OPEN (Terbuka)' : 'CLOSED (Ditutup)'}!`,
				'success'
			);
		} catch (err: any) {
			showToast('Gagal mengubah status slot:\n' + err.message, 'error');
		} finally {
			slotActionLoadingMap[key] = false;
		}
	}

	// --- MODAL DRAWER LIST PASIEN PER SLOT JADWAL ---
	let selectedScheduleModal = $state<DoctorSchedule | null>(null);
	let isScheduleModalOpen = $state(false);

	function openSchedulePatients(schedule: DoctorSchedule) {
		selectedScheduleModal = schedule;
		isScheduleModalOpen = true;
	}

	function closeSchedulePatients() {
		isScheduleModalOpen = false;
		selectedScheduleModal = null;
	}

	// --- MODAL REKAM MEDIS LENGKAP PASIEN ---
	let selectedPatientRecordModal = $state<DoctorExaminedPatient | null>(null);
	let isPatientRecordModalOpen = $state(false);

	function openPatientRecordModal(patientId: string) {
		const found = doctorPracticeStore.examinedPatients.find(
			(p: DoctorExaminedPatient) =>
				p.patientId === patientId || p.name.toLowerCase().includes(patientId.toLowerCase())
		);

		if (found) {
			selectedPatientRecordModal = found;
		} else {
			selectedPatientRecordModal = {
				patientId: patientId,
				name: activePatient ? activePatient.patientName : 'Pasien MedSync',
				age: activePatient ? activePatient.age : 30,
				gender: activePatient ? activePatient.gender : 'Perempuan',
				phone: activePatient ? activePatient.phone : '0812-0000-1111',
				address: 'Jl. RS Medika Utama, Surabaya',
				totalVisits: 1,
				lastVisitDate: todayDateDisplay,
				primaryDiagnosis: diagnosis,
				histories: [
					{
						id: 'REC-CURRENT',
						patient_name: activePatient?.patientName || 'Pasien MedSync',
						patient_age: activePatient?.age || 30,
						gender: activePatient?.gender || 'Perempuan',
						visitDate: `${todayDateDisplay} (${activePatient?.timeSlot || 'Sesi Praktik'})`,
						sessionType: 'Pemeriksaan Rutin Dokter Spesialis',
										complaint: activePatient?.complaint || 'Pemeriksaan Kesehatan',
						diagnosis: diagnosis,
						prescription: selectedMedicines.length
											? selectedMedicines.map((medicine) => ({
													name: medicine.name,
												rules_using: medicine.usage
												}))
											: [{ name: 'Paracetamol 500mg', rules_using: '3x1 Tablet' }],
						vitalSigns: activePatient?.vitalSigns || 'TD: 120/80 mmHg | Suhu: 36.8°C',
						doctorNotes: 'Pasien telah diperiksa secara menyeluruh. Disarankan istirahat cukup.',
						status: 'Rawat Jalan'
					}
				]
			};
		}
		isPatientRecordModalOpen = true;
	}

	function closePatientRecordModal() {
		isPatientRecordModalOpen = false;
		selectedPatientRecordModal = null;
	}

	// --- FORM PEMBUATAN JADWAL PRAKTEK MULTI-SLOT (BATCH) ATAU SINGLE-SLOT ---
	let scheduleFormMode = $state<'single' | 'batch'>('batch');
	let targetScheduleDate = $state(todayDateStr);
	let singleSlot = $state<{
		sessionName: string;
		startTime: string;
		endTime: string;
		quota: number;
	}>({
		sessionName: 'Sesi Utama',
		startTime: '08:00',
		endTime: '10:00',
		quota: 10
	});
	let batchSlots = $state<
		Array<{ sessionName: string; startTime: string; endTime: string; quota: number }>
	>([
		{ sessionName: 'Sesi 1 (Pagi Awal)', startTime: '08:00', endTime: '10:00', quota: 10 },
		{ sessionName: 'Sesi 2 (Pagi Akhir)', startTime: '10:00', endTime: '12:00', quota: 10 },
		{ sessionName: 'Sesi 3 (Siang)', startTime: '13:00', endTime: '15:00', quota: 8 },
		{ sessionName: 'Sesi 4 (Sore)', startTime: '15:00', endTime: '17:00', quota: 8 },
		{ sessionName: 'Sesi 5 (Malam)', startTime: '18:00', endTime: '20:00', quota: 6 }
	]);

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
			batchSlots = batchSlots.filter((_, i) => i !== index);
		}
	}

	function handleGenerate5SlotsPreset() {
		batchSlots = [
			{ sessionName: 'Sesi 1 (Pagi Awal)', startTime: '08:00', endTime: '10:00', quota: 10 },
			{ sessionName: 'Sesi 2 (Pagi Akhir)', startTime: '10:00', endTime: '12:00', quota: 10 },
			{ sessionName: 'Sesi 3 (Siang)', startTime: '13:00', endTime: '15:00', quota: 8 },
			{ sessionName: 'Sesi 4 (Sore)', startTime: '15:00', endTime: '17:00', quota: 8 },
			{ sessionName: 'Sesi 5 (Malam)', startTime: '18:00', endTime: '20:00', quota: 6 }
		];
	}

	async function handleSaveSchedule(e: Event) {
		e.preventDefault();

		const selectedSlots = scheduleFormMode === 'single' ? [singleSlot] : batchSlots;

		const slotsPayload = selectedSlots.map((slot) => ({
			name: slot.sessionName,
			start_hour: slot.startTime,
			end_hour: slot.endTime,
			status_slot: 'OPEN' as const,
			is_active: true,
			max_patient: Number(slot.quota)
		}));

		try {
			const res = await doctorPracticeStore.createPracticeSchedule({
				practice_date: targetScheduleDate,
				slots: slotsPayload
			});
			showToast(res.message || `Berhasil membuat slot jadwal praktik!`, 'success');
		} catch (err: any) {
			showToast('Gagal membuat jadwal praktik:\n' + err.message, 'error');
		}
	}

	// Filter Tab Jadwal Per Sesi
	function getSessionCardStatus(card: PracticeSessionCard): 'Dimulai' | 'Akan Datang' | 'Selesai' {
		if (card.date < todayDateStr) return 'Selesai';
		if (card.date > todayDateStr) return 'Akan Datang';
		return 'Dimulai';
	}

	let scheduleTabFilter = $state<'semua' | 'hari_ini' | 'akan_datang' | 'selesai'>('semua');
	let filteredSessionCards = $derived(
		doctorPracticeStore.sessionCards.filter((card: PracticeSessionCard) => {
			const st = getSessionCardStatus(card);
			if (scheduleTabFilter === 'hari_ini') return card.date === todayDateStr;
			if (scheduleTabFilter === 'akan_datang') return st === 'Akan Datang';
			if (scheduleTabFilter === 'selesai') return st === 'Selesai';
			return true;
		})
	);

	// Search Pasien Database
	let patientSearchQuery = $state('');
	let filteredPatientDatabase = $derived(
		doctorPracticeStore.examinedPatients.filter(
			(p: DoctorExaminedPatient) =>
				p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
				p.patientId.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
				p.primaryDiagnosis.toLowerCase().includes(patientSearchQuery.toLowerCase())
		)
	);
</script>

<Title title="Dokter | Dashboard MedSync" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="dokter"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(m) => (activeMenu = m)}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="relative flex h-full flex-1 flex-col overflow-hidden">
		<!-- FLOATING TOAST NOTIFICATION BANNER -->
		{#if toastNotification}
			<div class="animate-fade-in fixed top-5 right-5 z-50 max-w-md shadow-2xl transition-all">
				<div
					class={`flex items-start gap-3.5 rounded-2xl border p-4.5 shadow-xl backdrop-blur-md ${
						toastNotification.type === 'success'
							? 'border-emerald-200 bg-slate-900/95 text-emerald-300 ring-1 ring-emerald-500/30'
							: 'border-rose-300 bg-rose-950/95 text-rose-100 ring-1 ring-rose-500/40'
					}`}
				>
					<span class="mt-0.5 text-xl">{toastNotification.type === 'success' ? '✨' : '⚠️'}</span>
					<div class="flex-1 pr-2">
						<h4 class="text-[11px] font-black tracking-wider text-slate-300 uppercase">
							{toastNotification.type === 'success'
								? 'Pemberitahuan Sukses'
								: 'Pemberitahuan Sistem'}
						</h4>
						<p class="mt-1 text-xs leading-relaxed font-semibold whitespace-pre-line">
							{toastNotification.message}
						</p>
					</div>
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onclick={() => (toastNotification = null)}
						class="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
					>
						&times;
					</button>
				</div>
			</div>
		{/if}
		<!-- Header Mobile -->
		{#if !isForbidden}
			<header
				class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden"
			>
				<!-- svelte-ignore a11y_consider_explicit_label -->
				<button onclick={() => (isSidebarOpen = true)} class="text-sky-700">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-7 w-7"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
						/>
					</svg>
				</button>
				<div
					class="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
				>
					ID: {currentUser.user_code || currentUser.id}
				</div>
			</header>
		{/if}

		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-8' : ''}>
			{#if isLoading}
				<DashboardSkeletonDokter />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- HIGHLIGHT BANNER: PANEL DOKTER & HARI AKTIF -->
				<div
					class="relative mb-8 overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-6 text-white shadow-xl sm:p-8"
				>
					<div
						class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl"
					></div>

					<div
						class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
					>
						<div>
							<div class="mb-3 flex items-center gap-2">
								<span class="relative flex h-2.5 w-2.5">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
									></span>
									<span
										class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
									></span>
								</span>
								<p class="text-[11px] font-bold tracking-widest text-sky-200 uppercase">
									Mode Praktik Aktif &bull; {todayDateDisplay}
								</p>
							</div>

							<h1 class="text-3xl font-black sm:text-4xl">
								Halo, dr. {currentUser.name || 'Dokter'}! 🩺
							</h1>
							<p class="mt-2 text-sm text-slate-300 sm:text-base">
								Prioritas data hari ini: Terdapat <strong class="text-white"
									>{todayStats.waiting} pasien menunggu antrean</strong
								>
								dari total {todayStats.total} pendaftar hari ini.
							</p>
						</div>

						<div class="flex flex-col items-start gap-2 sm:items-end">
							<div
								class="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 shadow-inner backdrop-blur-md"
							>
								<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
									SIP / ID Dokter
								</p>
								<p class="mt-0.5 text-lg font-black tracking-wider text-white">
									{currentUser.user_code || currentUser.id}
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- ===================== -->
				<!-- MENU 1: BERANDA       -->
				<!-- ===================== -->
				{#if activeMenu === 'beranda'}
					<!-- 1. STATISTIK CEPAT PASIEN HARI INI -->
					<section class="mb-6 grid gap-4 sm:grid-cols-4">
						<div class="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600"
								>
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path
											d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
										/>
									</svg>
								</div>
								<p class="text-sm font-bold text-slate-600">Pasien Hari Ini</p>
							</div>
							<p class="mt-3 text-3xl font-black text-slate-800">
								{todayStats.total}
								<span class="text-xs font-semibold text-slate-400">terdaftar</span>
							</p>
						</div>

						<div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
								>
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<p class="text-sm font-bold text-slate-600">Sedang Diperiksa</p>
							</div>
							<p class="mt-3 text-3xl font-black text-emerald-600">{todayStats.examining}</p>
						</div>

						<div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600"
								>
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<p class="text-sm font-bold text-slate-600">Menunggu Antrean</p>
							</div>
							<p class="mt-3 text-3xl font-black text-amber-600">{todayStats.waiting}</p>
						</div>

						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
								>
									<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<p class="text-sm font-bold text-slate-600">Selesai Diperiksa</p>
							</div>
							<p class="mt-3 text-3xl font-black text-slate-700">{todayStats.finished}</p>
						</div>
					</section>

					<!-- 2. HIGHLIGHT PASIEN AKTIF & DETAIL SPESIFIKASI KELUHAN -->
					{#if activePatient && todayStats.examining > 0 && todayStats.waiting > 0}
						<section
							class="mb-6 overflow-hidden rounded-[24px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl lg:p-8"
						>
							<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
								<div class="space-y-4 lg:w-2/3">
									<div class="flex items-center gap-3">
										<span class="relative flex h-3 w-3">
											<span
												class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
											></span>
											<span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
										</span>
										<p class="text-xs font-extrabold tracking-widest text-emerald-400 uppercase">
											Pasien Aktif Diperiksa (Antrean #{activePatient.queueNumber})
										</p>
									</div>

									<div>
										<h2 class="text-3xl font-black tracking-tight sm:text-4xl">
											{activePatient.patientName}
											<span class="text-lg font-normal text-slate-300"
												>({activePatient.gender}, {activePatient.age} tahun)</span
											>
										</h2>
										<p class="mt-1 text-sm font-medium text-slate-300">
											No. Rekam Medis: <span class="font-bold text-sky-300"
												>{activePatient.patientId}</span
											>
											&bull; Telepon: {activePatient.phone} &bull; Jam: {activePatient.timeSlot}
										</p>
									</div>

									<div
										class="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner backdrop-blur-md"
									>
										<p class="text-[11px] font-bold tracking-wider text-amber-300 uppercase">
											🩺 Keluhan Utama Hari Ini
										</p>
										<p class="mt-1 text-lg font-bold text-white">{activePatient.complaint}</p>

										<div class="mt-3 border-t border-white/10 pt-3">
											<p class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
												Rincian Gejala & Catatan Pasien
											</p>
											<p class="mt-1 text-xs leading-relaxed text-slate-200">
												{activePatient.detail_sympton}
											</p>
										</div>

										{#if activePatient.vitalSigns}
											<div
												class="mt-3 flex flex-wrap gap-2 pt-1 text-xs font-semibold text-emerald-300"
											>
												<span class="rounded-md bg-emerald-500/20 px-2 py-1"
													>📊 {activePatient.vitalSigns}</span
												>
											</div>
										{/if}
									</div>
								</div>

								<!-- AKSI CEPAT PASIEN AKTIF -->
								<div
									class="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-5 lg:w-1/3"
								>
									<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">
										Aksi Pemeriksaan
									</p>
									<button
										onclick={() => handleFinishPatient(activePatient.id)}
										class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
									>
										✓ Tandai Selesai Diperiksa
									</button>
									<button
										onclick={() => openPatientRecordModal(activePatient.patientId)}
										class="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
									>
										📁 Buka Rekam Medis Pasien Ini
									</button>
								</div>
							</div>
						</section>
					{/if}

					<div class="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
						<!-- KIRI: FORM RESEP & TINDAKAN -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
								<div>
									<h2 class="text-xl font-bold text-slate-900">Resep & Tindakan Medis</h2>
									<p class="text-xs text-slate-500">
										Inputkan diagnosis & resep obat untuk pasien {activePatient
											? activePatient.patientName
											: ''}
									</p>
								</div>
							</div>

							<form
								onsubmit={(e) => {
									e.preventDefault();
									if (activePatient) handleFinishPatient(activePatient.id);
								}}
								class="space-y-5"
							>
								<label class="block">
									<span class="mb-2 block text-sm font-bold text-slate-700"
										>Hasil Diagnosis Dokter</span
									>
									<input
										bind:value={diagnosis}
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
										placeholder="Tuliskan hasil diagnosa..."
									/>
								</label>

								<div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
									<label class="block">
										<span class="mb-2 block text-sm font-bold text-slate-700"
											>Cari Obat (Katalog Apotek RS)</span
										>
										<input
											bind:value={searchQuery}
											class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											placeholder="Ketik nama obat atau kategori..."
										/>
									</label>

									<div class="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-2">
										{#each filteredMedicines as medicine (medicine.name)}
											<div
												class={`flex flex-col justify-between rounded-xl border p-3 sm:flex-row sm:items-center ${selectedMedicines.some((m) => m.name === medicine.name) ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
											>
												<div>
													<p class="font-bold text-slate-900">{medicine.name}</p>
													<p class="text-xs font-medium text-slate-500">
														{medicine.category} &bull; {medicine.notes}
													</p>
												</div>
												<button
													type="button"
													class={`mt-2 shrink-0 rounded-lg border px-4 py-1.5 text-xs font-bold sm:mt-0 ${selectedMedicines.some((m) => m.name === medicine.name) ? 'border-red-200 bg-white text-red-600 hover:bg-red-50' : 'border-slate-300 bg-slate-900 text-white hover:bg-slate-700'}`}
													onclick={() => toggleMedicine(medicine.name)}
												>
													{selectedMedicines.some((m) => m.name === medicine.name)
														? 'Batalkan'
														: '+ Resepkan'}
												</button>
											</div>
											{#if selectedMedicines.some((m) => m.name === medicine.name)}
												<div class="mt-1 ml-4 border-l-2 border-sky-200 pl-3">
													<input
														class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-500"
														placeholder="Aturan Pakai (misal: 3x1 tablet setelah makan)"
														value={selectedMedicines.find((m) => m.name === medicine.name)?.usage ??
															''}
														oninput={(e) =>
															updateMedicineUsage(medicine.name, e.currentTarget.value)}
													/>
												</div>
											{/if}
										{/each}
									</div>
								</div>

								<button
									type="submit"
									class="w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
								>
									Selesai Pemeriksaan & Cetak Resep Digital
								</button>
							</form>
						</section>

						<!-- KANAN: DAFTAR ANTREAN PASIEN HARI INI & DETAIL KELUHAN -->
						<aside class="space-y-6">
							<div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
								<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
									<h3 class="text-lg font-bold text-slate-900">Daftar Antrean Pasien Hari Ini</h3>
									<span class="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-extrabold text-sky-700"
										>{todayPatients.length} Pasien</span
									>
								</div>

								<div class="max-h-[500px] space-y-3 overflow-y-auto pr-1">
									{#each todayPatients as patient (patient.id)}
										<div
											class={`rounded-2xl border p-4 transition-all ${patient.status === 'Sedang Diperiksa' ? 'border-emerald-400 bg-emerald-50/40 shadow-sm' : patient.status === 'Selesai' ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white hover:border-slate-300'}`}
										>
											<div class="flex items-start justify-between">
												<div class="flex items-center gap-3">
													<div
														class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${patient.status === 'Sedang Diperiksa' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
													>
														#{patient.queueNumber}
													</div>
													<div>
														<div class="flex items-center gap-2">
															<p class="font-bold text-slate-900">{patient.patientName}</p>
															{#if patient.isUrgent}
																<span
																	class="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-600 uppercase"
																	>Prioritas</span
																>
															{/if}
														</div>
														<p class="text-xs font-semibold text-slate-500">
															No. RM: {patient.patientId} &bull; {patient.timeSlot}
														</p>
													</div>
												</div>

												<span
													class={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
														patient.status === 'Sedang Diperiksa'
															? 'animate-pulse bg-emerald-100 text-emerald-700'
															: patient.status === 'Menunggu'
																? 'bg-amber-100 text-amber-700'
																: 'bg-slate-200 text-slate-700'
													}`}
												>
													{patient.status}
												</span>
											</div>

											<div
												class="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs"
											>
												<p class="font-bold text-slate-800">
													📋 Keluhan: <span class="font-normal text-slate-600"
														>{patient.complaint}</span
													>
												</p>
												<p class="mt-1 line-clamp-2 text-[11px] text-slate-500">
													{patient.detail_sympton}
												</p>
											</div>

											{#if patient.status === 'Menunggu'}
												<div class="mt-3 flex justify-end">
													<button
														onclick={() => handleCallPatient(patient.id)}
														class="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700"
													>
														Panggil ke Ruang Periksa
													</button>
												</div>
											{/if}
										</div>
									{:else}
										<div
											class="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-xs text-slate-400"
										>
											Belum ada antrean pasien untuk hari ini.
										</div>
									{/each}
								</div>
							</div>

							<!-- STRUK DIGITAL PREVIEW -->
							<div class="rounded-[24px] bg-slate-900 p-5 text-white shadow-lg sm:p-6">
								<div class="mb-4 flex items-center justify-between border-b border-slate-700 pb-4">
									<div>
										<h3 class="text-lg font-bold">Struk Digital Resep</h3>
										<p class="text-xs text-slate-400">Pratinjau resep pasien aktif</p>
									</div>
									{#if receiptVisible}
										<button
											type="button"
											class="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold hover:bg-sky-400"
											onclick={printReceipt}>Print PDF</button
										>
									{/if}
								</div>

								{#if receiptVisible && activePatient}
									<div
										class="receipt-print-shell mt-2 rounded-2xl bg-white p-4 text-slate-900 shadow-inner"
									>
										<div
											class="receipt-print-card mx-auto w-full max-w-[280px] rounded-[16px] border border-slate-200 bg-[#fffdf8] p-3"
										>
											<div class="text-center">
												<p class="text-[11px] font-black tracking-[0.35em] uppercase">
													RS Medika Sehat
												</p>
												<p class="mt-1 text-[9px] tracking-[0.3em] text-slate-500 uppercase">
													Resep Dokter Digital
												</p>
											</div>
											<hr class="receipt-print-divider" />
											<div class="text-[10px] text-slate-600">
												<p>
													<span class="font-bold text-slate-900">Pasien:</span>
													{activePatient.patientName} ({activePatient.patientId})
												</p>
												<p><span class="font-bold text-slate-900">Diagnosa:</span> {diagnosis}</p>
												<div class="mt-3">
													<p class="font-bold tracking-[0.2em] text-slate-900 uppercase">
														Daftar Obat
													</p>
													<ul class="mt-2 space-y-2">
														{#each selectedMedicines as item (item.name)}
															<li class="receipt-print-line-item">
																<p class="font-bold text-slate-900">{item.name}</p>
																<p class="text-[9px] text-slate-500">
																	{item.usage || 'Aturan tidak tertulis'}
																</p>
															</li>
														{/each}
													</ul>
												</div>
											</div>
										</div>
									</div>
								{:else}
									<div
										class="rounded-xl border-2 border-dashed border-slate-700 p-8 text-center text-xs text-slate-400"
									>
										Selesaikan pemeriksaan untuk mencetak struk resep digital.
									</div>
								{/if}
							</div>
						</aside>
					</div>

					<!-- ============================================== -->
					<!-- MENU 2: JADWAL PRAKTEK & SLOTS TERPERINCI      -->
					<!-- ============================================== -->
				{:else if activeMenu === 'jadwal'}
					<div class="space-y-6">
						<!-- HEADER & TAB FILTER -->
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h2 class="text-2xl font-black text-slate-900">
									Spesifikasi Jadwal Praktik Dokter
								</h2>
								<p class="text-sm text-slate-500">
									Kelola slot jam praktik 1 minggu ke depan dan pantau pasien yang mendaftar.
								</p>
							</div>

							<div class="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
								<button
									onclick={() => (scheduleTabFilter = 'semua')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${scheduleTabFilter === 'semua' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
								>
									Semua ({doctorPracticeStore.sessionCards.length})
								</button>
								<button
									onclick={() => (scheduleTabFilter = 'hari_ini')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${scheduleTabFilter === 'hari_ini' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
								>
									Hari Ini ({doctorPracticeStore.sessionCards.filter(
										(c: PracticeSessionCard) => c.date === todayDateStr
									).length})
								</button>
								<button
									onclick={() => (scheduleTabFilter = 'akan_datang')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${scheduleTabFilter === 'akan_datang' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
								>
									Akan Datang ({doctorPracticeStore.sessionCards.filter(
										(c: PracticeSessionCard) => getSessionCardStatus(c) === 'Akan Datang'
									).length})
								</button>
								<button
									onclick={() => (scheduleTabFilter = 'selesai')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${scheduleTabFilter === 'selesai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
								>
									Selesai ({doctorPracticeStore.sessionCards.filter(
										(c: PracticeSessionCard) => getSessionCardStatus(c) === 'Selesai'
									).length})
								</button>
							</div>
						</div>

						<div class="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
							<!-- KIRI: KARTU LIST JADWAL PRAKTEK SPESIFIK DENGAN STATUS PER SESI -->
							<section class="space-y-4">
								{#each filteredSessionCards as card (card.id)}
									{@const cardStatus = getSessionCardStatus(card)}
									<div
										class={`group relative overflow-hidden rounded-[24px] border p-6 transition-all ${
											cardStatus === 'Dimulai'
												? 'border-emerald-300 bg-gradient-to-r from-emerald-50/50 via-white to-white shadow-md'
												: cardStatus === 'Akan Datang'
													? 'border-sky-200 bg-white shadow-sm hover:border-sky-300'
													: 'border-slate-200 bg-slate-50/80 opacity-75'
										}`}
									>
										<div class="flex flex-col gap-4">
											<!-- ATAS: BADGE STATUS, JUDUL SESI, JAM PRAKTIK & PROGRESS BAR -->
											<div>
												<div class="flex flex-wrap items-center gap-2.5">
													<span
														class={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black tracking-wider uppercase ${
															cardStatus === 'Dimulai'
																? 'bg-emerald-100 text-emerald-700 shadow-sm'
																: cardStatus === 'Akan Datang'
																	? 'bg-sky-100 text-sky-700'
																	: 'bg-slate-200 text-slate-600'
														}`}
													>
														{#if cardStatus === 'Dimulai'}
															<span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
															></span>
															🟢 Dimulai (Sedang Berlangsung)
														{:else if cardStatus === 'Akan Datang'}
															<span class="h-2 w-2 rounded-full bg-sky-500"></span>
															🔵 Akan Datang
														{:else}
															<span class="h-2 w-2 rounded-full bg-slate-400"></span>
															⚪ Selesai
														{/if}
													</span>

													<!-- BADGE STATUS SLOT OPEN/CLOSED & QUOTA FULL -->
													{#if card.isFull || card.status_slot === 'CLOSED'}
														<span
															class="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black tracking-wider text-rose-700 uppercase"
														>
															🔴 CLOSED {card.isFull ? '(QUOTA PENUH)' : '(DITUTUP)'}
														</span>
													{:else}
														<span
															class="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-700 uppercase"
														>
															🟢 OPEN (TERBUKA)
														</span>
													{/if}

													<!-- BADGE STATUS AKTIF -->
													<span
														class={`rounded-full px-3 py-1 text-[11px] font-bold ${card.is_active ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}`}
													>
														{card.is_active ? 'Status: Aktif' : 'Status: Nonaktif'}
													</span>

													<span class="text-xs font-bold text-slate-500">📅 {card.dateDisplay}</span
													>
												</div>

												<h3 class="mt-3 text-xl font-black text-slate-900">{card.sessionName}</h3>
												<p class="mt-1 text-sm font-semibold text-slate-600">
													⏰ Jam Praktik: <strong class="text-slate-900"
														>{card.startTime} - {card.endTime} WIB</strong
													>
													&bull; Ruang: {card.room}
												</p>

												<!-- PROGRESS BAR PASIEN TERISI / KUOTA -->
												<div class="mt-3 w-full sm:w-80">
													<div
														class="flex items-center justify-between text-xs font-bold text-slate-600"
													>
														<span
															>Terisi: {card.current_patient_count} / {card.quota} Pasien {card.isFull
																? '(FULL)'
																: ''}</span
														>
														<span
															>{Math.round((card.current_patient_count / card.quota) * 100)}%</span
														>
													</div>
													<div
														class="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
													>
														<div
															class={`h-full rounded-full transition-all duration-500 ${card.isFull ? 'bg-rose-500' : 'bg-sky-600'}`}
															style={`width: ${Math.min(100, (card.current_patient_count / card.quota) * 100)}%`}
														></div>
													</div>
												</div>
											</div>

											<!-- BAWAH: FOOTER DENGAN KONTROL SESI & TOMBOL LIHAT PASIEN -->
											<div
												class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5"
											>
												<div class="flex flex-wrap items-center gap-2">
													<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
														>Kontrol Sesi:</span
													>
													<button
														type="button"
														disabled={slotActionLoadingMap[`status_${card.slotId}`]}
														onclick={() => handleUpdateSlotStatus(card.slotId, card.status_slot)}
														class={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
															card.status_slot === 'OPEN'
																? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
																: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
														}`}
													>
														{#if slotActionLoadingMap[`status_${card.slotId}`]}
															<svg
																class="h-3.5 w-3.5 animate-spin text-current"
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
															>
																<circle
																	class="opacity-25"
																	cx="12"
																	cy="12"
																	r="10"
																	stroke="currentColor"
																	stroke-width="4"
																></circle>
																<path
																	class="opacity-75"
																	fill="currentColor"
																	d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																></path>
															</svg>
															<span>Memproses...</span>
														{:else}
															<span
																>{card.status_slot === 'OPEN'
																	? 'Tutup Sesi (Set CLOSED)'
																	: 'Buka Sesi (Set OPEN)'}</span
															>
														{/if}
													</button>

													<button
														type="button"
														disabled={slotActionLoadingMap[`active_${card.slotId}`]}
														onclick={() => handleToggleSlotActive(card.slotId, !card.is_active)}
														class={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
															card.is_active
																? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
																: 'bg-slate-200 text-slate-700 hover:bg-slate-300'
														}`}
													>
														{#if slotActionLoadingMap[`active_${card.slotId}`]}
															<svg
																class="h-3.5 w-3.5 animate-spin text-current"
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
															>
																<circle
																	class="opacity-25"
																	cx="12"
																	cy="12"
																	r="10"
																	stroke="currentColor"
																	stroke-width="4"
																></circle>
																<path
																	class="opacity-75"
																	fill="currentColor"
																	d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																></path>
															</svg>
															<span>Memproses...</span>
														{:else}
															<span>{card.is_active ? 'Nonaktifkan Sesi' : 'Aktifkan Sesi'}</span>
														{/if}
													</button>
												</div>

												<button
													type="button"
													onclick={() =>
														openSchedulePatients({
															id: card.practiceId,
															date: card.date,
															dateDisplay: card.dateDisplay,
															dayName: card.dayName,
															sessionName: card.sessionName,
															startTime: card.startTime,
															endTime: card.endTime,
															quota: card.quota,
															room: card.room,
															patients: card.patients
														})}
													class="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-sky-700 active:scale-95"
												>
													<svg
														class="h-4 w-4 text-sky-400"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
														/>
													</svg>
													Lihat Pasien Mendaftar ({card.patients.length})
												</button>
											</div>
										</div>
									</div>
								{:else}
									<div
										class="rounded-[24px] border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400"
									>
										Belum ada data slot jadwal praktik yang terdaftar pada database.
									</div>
								{/each}
							</section>

							<!-- KANAN: FORM BUAT JADWAL PRAKTEK -->
							<aside class="space-y-6">
								<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
									<div class="mb-5 border-b border-slate-100 pb-4">
										<div class="flex items-center justify-between">
											<h3 class="text-xl font-bold text-slate-900">Buat Slot Jadwal Praktik</h3>
											<span
												class="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 uppercase"
												>1 Minggu Ke Depan</span
											>
										</div>
										<p class="mt-1 text-xs text-slate-500">
											Atur jam operasional dan kuota pasien untuk sesi praktik Anda.
										</p>
									</div>

									<!-- MODE TOGGLE FORM -->
									<div class="mb-5 flex rounded-xl bg-slate-100 p-1">
										<button
											type="button"
											onclick={() => (scheduleFormMode = 'batch')}
											class={`flex-1 rounded-lg py-2 text-xs font-bold transition ${scheduleFormMode === 'batch' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
										>
											⚡ Multi-Slot Batch (5 Sesi/Hari)
										</button>
										<button
											type="button"
											onclick={() => (scheduleFormMode = 'single')}
											class={`flex-1 rounded-lg py-2 text-xs font-bold transition ${scheduleFormMode === 'single' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
										>
											Single Slot (1 Sesi)
										</button>
									</div>

									<form onsubmit={handleSaveSchedule} class="space-y-4">
										<label class="block">
											<span class="mb-1.5 block text-xs font-bold text-slate-700"
												>Tanggal Praktik</span
											>
											<input
												type="date"
												bind:value={targetScheduleDate}
												required
												class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
											/>
										</label>

										{#if scheduleFormMode === 'batch'}
											<div class="flex items-center justify-between">
												<span class="text-xs font-bold text-slate-700"
													>Daftar Slot Jam Praktik Hari Tersebut</span
												>
												<button
													type="button"
													onclick={handleGenerate5SlotsPreset}
													class="text-[11px] font-bold text-sky-600 hover:underline"
												>
													⚡ Auto-fill 5 Sesi Standard
												</button>
											</div>

											<div class="max-h-[340px] space-y-3 overflow-y-auto pr-1">
												{#each batchSlots as slot, index (index)}
													<div class="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
														<div class="flex items-center justify-between">
															<span class="text-xs font-black text-slate-800"
																>Slot #{index + 1}</span
															>
															{#if batchSlots.length > 1}
																<button
																	type="button"
																	onclick={() => removeBatchSlotRow(index)}
																	class="text-xs font-bold text-rose-600 hover:underline"
																	>Hapus</button
																>
															{/if}
														</div>

														<input
															bind:value={slot.sessionName}
															placeholder="Nama Sesi (misal: Sesi Pagi 1)"
															required
															class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
														/>

														<div class="grid grid-cols-3 gap-2">
															<div>
																<span class="block text-[10px] font-bold text-slate-500">Mulai</span
																>
																<input
																	type="time"
																	bind:value={slot.startTime}
																	required
																	class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
																/>
															</div>
															<div>
																<span class="block text-[10px] font-bold text-slate-500"
																	>Selesai</span
																>
																<input
																	type="time"
																	bind:value={slot.endTime}
																	required
																	class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
																/>
															</div>
															<div>
																<span class="block text-[10px] font-bold text-slate-500">Kuota</span
																>
																<input
																	type="number"
																	min="1"
																	max="100"
																	bind:value={slot.quota}
																	required
																	class="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
																/>
															</div>
														</div>
													</div>
												{/each}
											</div>

											<button
												type="button"
												onclick={addBatchSlotRow}
												class="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
											>
												+ Tambah Baris Slot
											</button>
										{:else}
											<!-- Single Slot Form -->
											<label class="block">
												<span class="mb-1 block text-xs font-bold text-slate-700">Nama Sesi</span>
												<input
													bind:value={singleSlot.sessionName}
													required
													class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm"
												/>
											</label>
											<div class="grid grid-cols-2 gap-3">
												<label class="block">
													<span class="mb-1 block text-xs font-bold text-slate-700">Jam Mulai</span>
													<input
														type="time"
														bind:value={singleSlot.startTime}
														required
														class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
													/>
												</label>
												<label class="block">
													<span class="mb-1 block text-xs font-bold text-slate-700"
														>Jam Selesai</span
													>
													<input
														type="time"
														bind:value={singleSlot.endTime}
														required
														class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
													/>
												</label>
											</div>
											<label class="block">
												<span class="mb-1 block text-xs font-bold text-slate-700"
													>Maksimal Kuota Pasien</span
												>
												<input
													type="number"
													min="1"
													max="100"
													bind:value={singleSlot.quota}
													required
													class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm"
												/>
											</label>
										{/if}

										<button
											type="submit"
											class="w-full rounded-xl bg-slate-900 py-3.5 text-xs font-bold text-white shadow-lg transition hover:bg-sky-700"
										>
											{scheduleFormMode === 'batch'
												? `Buka ${batchSlots.length} Slot Jadwal Sekaligus`
												: 'Buka Slot Jadwal Praktik'}
										</button>
									</form>
								</div>
							</aside>
						</div>
					</div>

					<!-- ============================================== -->
					<!-- MENU 3: DAFTAR PASIEN & REKAM MEDIS DOKTER     -->
					<!-- ============================================== -->
				{:else if activeMenu === 'pasien'}
					<div class="space-y-6">
						<!-- HEADER DATABASE PASIEN DOKTER -->
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<div class="flex items-center gap-2">
									<h2 class="text-2xl font-black text-slate-900">
										Daftar Pasien dr. {currentUser.name || 'Spesialis'}
									</h2>
									<span class="rounded-lg bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-700">
										{doctorPracticeStore.examinedPatients.length} Pasien
									</span>
								</div>
								<p class="mt-1 text-xs text-slate-500">
									Manajemen data dan riwayat rekam medis pasien yang ditangani.
								</p>
							</div>

							<div class="w-full sm:w-72">
								<input
									bind:value={patientSearchQuery}
									oninput={() => doctorPracticeStore.fetchPatientHistory(patientSearchQuery)}
									class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									placeholder="Cari nama, RM, atau diagnosa..."
								/>
							</div>
						</div>

						<!-- GRID KARTU PASIEN PASIEN DOKTER -->
						<div class="grid gap-5 md:grid-cols-2">
							{#each filteredPatientDatabase as p (p.patientId)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									onclick={() => openPatientRecordModal(p.patientId)}
									class="group relative flex cursor-pointer flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-sky-400 hover:shadow-md"
								>
									<div class="space-y-3">
										<div class="flex items-center justify-between border-b border-slate-100 pb-3">
											<span
												class="rounded-xl border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
											>
												No. RM: {p.patientId}
											</span>
											<span
												class="rounded-xl border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700"
											>
												📋 {p.totalVisits}x Kunjungan ke Dokter Ini
											</span>
										</div>

										<div class="flex items-start justify-between">
											<div>
												<h3
													class="text-xl font-black text-slate-900 transition group-hover:text-sky-600"
												>
													{p.name}
												</h3>
												<p class="mt-0.5 text-xs font-medium text-slate-500">
													{p.gender}, {p.age} thn &bull; 📞 {p.phone}
												</p>
											</div>

											<div
												class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-sky-600 group-hover:text-white"
											>
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</div>
										</div>

										<p class="text-xs text-slate-400">📍 {p.address}</p>

										<div class="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
											<p class="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
												Diagnosa Terakhir ({p.lastVisitDate})
											</p>
											<p class="text-xs font-bold text-slate-800">{p.primaryDiagnosis}</p>
										</div>
									</div>

									<div
										class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"
									>
										<span class="text-[11px] font-bold text-slate-400">
											Kunjungan Terakhir: {p.lastVisitDate}
										</span>
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												openPatientRecordModal(p.patientId);
											}}
											class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700"
										>
											📁 Buka Rekam Medis Pasien
										</button>
									</div>
								</div>
							{:else}
								<div
									class="col-span-full rounded-[24px] border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400"
								>
									Belum ada data pasien yang pernah diperiksa oleh Anda pada database server.
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>

<!-- ========================================================================= -->
<!-- MODAL DRAWER 1: DAFTAR PASIEN YANG MENDAFTAR PADA SLOT JADWAL PRAKTEK     -->
<!-- ========================================================================= -->
{#if isScheduleModalOpen && selectedScheduleModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
	>
		<div
			class="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-5 text-white"
			>
				<div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-black text-sky-300 uppercase"
						>
							{selectedScheduleModal.dateDisplay}
						</span>
						<span class="text-xs text-slate-300"
							>&bull; {selectedScheduleModal.startTime} - {selectedScheduleModal.endTime} WIB</span
						>
					</div>
					<h3 class="mt-1 text-xl font-black">{selectedScheduleModal.sessionName}</h3>
					<p class="text-xs text-slate-400">
						Daftar Pasien Terdaftar: {selectedScheduleModal.patients.length} dari {selectedScheduleModal.quota}
						Kuota
					</p>
				</div>

				<button
					onclick={closeSchedulePatients}
					class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
				>
					✕
				</button>
			</div>

			<div class="flex-1 space-y-4 overflow-y-auto p-6">
				{#each selectedScheduleModal.patients as patient (patient.id)}
					<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white"
								>
									#{patient.queueNumber}
								</div>
								<div>
									<h4 class="text-base font-bold text-slate-900">{patient.patientName}</h4>
									<p class="text-xs font-medium text-slate-500">
										No. RM: <strong class="text-slate-800">{patient.patientId}</strong> &bull; {patient.gender},
										{patient.age} thn &bull; {patient.phone}
									</p>
								</div>
							</div>

							<span
								class={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
									patient.status === 'Sedang Diperiksa'
										? 'animate-pulse bg-emerald-100 text-emerald-700'
										: patient.status === 'Menunggu'
											? 'bg-amber-100 text-amber-700'
											: 'bg-slate-200 text-slate-700'
								}`}
							>
								{patient.status}
							</span>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
							<p class="font-bold text-amber-800">🩺 Keluhan Utama:</p>
							<p class="mt-0.5 font-bold text-slate-900">{patient.complaint}</p>

							<p class="mt-2 text-[11px] font-bold text-slate-500 uppercase">
								Rincian Gejala & Riwayat:
							</p>
							<p class="mt-0.5 leading-relaxed text-slate-700">{patient.detail_sympton}</p>

							{#if patient.vitalSigns}
								<p class="mt-2 text-[11px] font-semibold text-emerald-700">
									📊 Tanda Vital: {patient.vitalSigns}
								</p>
							{/if}
						</div>

						<div class="flex justify-end gap-2 pt-1">
							<button
								onclick={() => {
									closeSchedulePatients();
									openPatientRecordModal(patient.patientId);
								}}
								class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
							>
								📁 Riwayat Rekam Medis
							</button>

							{#if patient.status === 'Menunggu'}
								<button
									onclick={() => {
										handleCallPatient(patient.id);
										closeSchedulePatients();
										activeMenu = 'beranda';
									}}
									class="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700"
								>
									Panggil Pasien Ini
								</button>
							{/if}
						</div>
					</div>
				{:else}
					<div
						class="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400"
					>
						Belum ada pasien yang mendaftar pada slot jadwal praktik ini.
					</div>
				{/each}
			</div>

			<div class="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
				<button
					onclick={closeSchedulePatients}
					class="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
				>
					Tutup List Pasien
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ========================================================================= -->
<!-- MODAL DRAWER 2: RIWAYAT REKAM MEDIS LENGKAP PASIEN DENGAN DOKTER INI       -->
<!-- ========================================================================= -->
{#if isPatientRecordModalOpen && selectedPatientRecordModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
	>
		<div
			class="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
		>
			<div
				class="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white"
			>
				<div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 uppercase"
						>
							No. RM: {selectedPatientRecordModal.patientId}
						</span>
						<span class="text-xs text-slate-300"
							>&bull; Total {selectedPatientRecordModal.histories.length} Pemeriksaan oleh Dokter Ini</span
						>
					</div>
					<h3 class="mt-1 text-2xl font-black tracking-tight">{selectedPatientRecordModal.name}</h3>
					<p class="text-xs text-slate-300">
						{selectedPatientRecordModal.gender}, {selectedPatientRecordModal.age} tahun &bull; 📞 {selectedPatientRecordModal.phone}
						&bull; 📍 {selectedPatientRecordModal.address}
					</p>
				</div>

				<button
					onclick={closePatientRecordModal}
					class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
				>
					✕
				</button>
			</div>

			<div class="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6">
				<div
					class="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-xs text-sky-900"
				>
					<div>
						<p class="font-bold text-sky-950">
							📋 Rekam Medis Dokter Spesifik: dr. {currentUser.name || 'Spesialis'}
						</p>
						<p class="mt-0.5 text-sky-800">
							Menampilkan seluruh riwayat pemeriksaan dan catatan diagnosa pasien yang pernah
							ditangani oleh Anda.
						</p>
					</div>
					<span
						class="shrink-0 rounded-xl border border-sky-200 bg-white px-3 py-1.5 font-black text-sky-700 shadow-sm"
					>
						{selectedPatientRecordModal.histories.length} Catatan Medis
					</span>
				</div>

				<div
					class="relative space-y-6 pl-4 before:absolute before:top-3 before:bottom-3 before:left-2 before:w-0.5 before:bg-slate-300"
				>
					{#each selectedPatientRecordModal.histories as record, idx (record.id)}
						<div class="relative pl-6">
							<span
								class="absolute top-1.5 left-[-11px] z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow-md"
							>
								{selectedPatientRecordModal.histories.length - idx}
							</span>

							<!-- Tambahkan overflow-hidden agar header abu-abu mengikuti border-radius card -->
							<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
								<!-- HEADER CARD (Background Abu-abu) -->
								<div
									class="flex flex-col gap-1 border-b border-slate-200 bg-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
								>
									<!-- Nama Lengkap (Teks tebal besar) -->
									<h3 class="text-base font-bold text-slate-900">{record.patient_name}</h3>

									<!-- Gender & Umur (Teks tipis sedang) -->
									<div class="flex items-center gap-2 text-sm font-normal text-slate-600">
										<span>{record.gender === 'LAKILAKI' ? 'Laki-Laki' : 'Perempuan'}</span>
										<span>•</span>
										<span>{record.patient_age} Tahun</span>
									</div>
								</div>

								<!-- KONTEN UTAMA CARD (Dipindah ke dalam wrapper padding p-5) -->
								<div class="space-y-4 p-5">
									<div
										class="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<div>
											<div class="flex items-center gap-2">
												<span class="text-sm font-black text-slate-900">📅 {record.visitDate}</span>
												<span
													class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
												>
													{record.sessionType}
												</span>
											</div>
										</div>

										<span
											class={`rounded-lg px-3 py-1 text-[10px] font-black uppercase ${
												record.status === 'Selesai'
													? 'bg-emerald-100 text-emerald-700'
													: record.status === 'Rawat Jalan'
														? 'bg-sky-100 text-sky-700'
														: 'bg-amber-100 text-amber-700'
											}`}
										>
											{record.status}
										</span>
									</div>

									{#if record.status === 'Selesai'}
									<div class="grid gap-3 sm:grid-cols-2">
										<div
											class="space-y-1 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs"
										>
											<p class="font-bold text-amber-900">🩺 Keluhan Utama Pasien:</p>
											<p class="leading-relaxed text-slate-800">{record.complaint}</p>
										</div>

										<div
											class="space-y-1 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs"
										>
											<p class="font-bold text-indigo-950">🔍 Hasil Diagnosis Dokter:</p>
											<p class="font-black text-indigo-900">{record.diagnosis}</p>
										</div>
									</div>

										<div class="grid gap-3 sm:grid-cols-2">
											<div class="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs">
												<p class="font-bold text-sky-900">SOAP Pemeriksaan</p>
												<div class="mt-2 space-y-1.5 text-slate-700">
													<p><strong>Subjective:</strong> {record.complaint || 'Belum diisi.'}</p>
													<p><strong>Objective:</strong> {record.doctorAssessment?.objective || 'Belum diisi.'}</p>
													<p><strong>Assessment:</strong> {record.doctorAssessment?.assesment || record.diagnosis}</p>
													<p><strong>Plan:</strong> {record.doctorAssessment?.plan || 'Belum diisi.'}</p>
													<p><strong>Catatan:</strong> {record.doctorAssessment?.notes || record.doctorNotes}</p>
												</div>
											</div>
											<div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs">
												<p class="font-bold text-emerald-900">Tanda Vital Perawat</p>
												<div class="mt-2 grid grid-cols-2 gap-1.5 text-slate-700">
													<p>TD: {record.nurseAssessment?.sistolic ?? '-'} / {record.nurseAssessment?.diastolic ?? '-'} mmHg</p>
													<p>Nadi: {record.nurseAssessment?.heart_rate ?? '-'} bpm</p>
													<p>RR: {record.nurseAssessment?.respiratory_rate ?? '-'}x/menit</p>
													<p>Suhu: {record.nurseAssessment?.temperature ?? '-'}°C</p>
													<p>BB: {record.nurseAssessment?.weight ?? '-'} kg</p>
													<p>TB: {record.nurseAssessment?.height ?? '-'} cm</p>
												</div>
											</div>
										</div>
										{/if}

									{#if record.prescription && record.prescription.length}
										<div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
											<p
												class="mb-2 text-[10px] font-extrabold tracking-wider text-slate-800 uppercase"
											>
												💊 Resep Obat Diberikan ({record.prescription.length} Obat)
											</p>
											<div class="space-y-1.5">
												{#each record.prescription as rx (rx.name)}
													<div
														class="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2"
													>
														<span class="font-bold text-slate-900">{rx.name}</span>
														<span
															class="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
														>
															{rx.rules_using}
														</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<div class="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
										<p class="font-bold text-emerald-800">
											📊 Tanda Vital: <span class="font-semibold text-slate-800"
												>{record.vitalSigns}</span
											>
										</p>
										<p class="font-bold text-slate-700">
											📝 Catatan & Tindakan Dokter: <span class="font-normal text-slate-600"
												>{record.doctorNotes}</span
											>
										</p>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
				<button
					type="button"
					onclick={() => window.print()}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
				>
					🖨️ Cetak / Print Rekam Medis
				</button>
				<button
					onclick={closePatientRecordModal}
					class="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
				>
					Tutup Rekam Medis
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.receipt-print-card {
		font-family: 'Courier New', Courier, monospace;
		font-size: 12px;
		color: #0f172a;
	}
	.receipt-print-divider {
		border-top: 1px dashed #cbd5e1;
		margin: 8px 0;
	}
	.receipt-print-line-item {
		border-bottom: 1px dashed #e2e8f0;
		padding-bottom: 4px;
		margin-bottom: 4px;
	}
	@media print {
		@page {
			size: 80mm auto;
			margin: 0;
		}
		:global(body) {
			background: #ffffff !important;
			margin: 0;
			padding: 0;
			width: 80mm;
		}
		:global(body *) {
			visibility: hidden;
		}
		.receipt-print-shell,
		.receipt-print-shell * {
			visibility: visible;
		}
		.receipt-print-shell {
			position: absolute;
			left: 0;
			top: 0;
			width: 80mm;
			margin: 0;
			padding: 0;
			background: #ffffff;
			border: none;
			box-shadow: none;
		}
		.receipt-print-card {
			width: 80mm;
			margin: 0 auto;
			border: none;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
