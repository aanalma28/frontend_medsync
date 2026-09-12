<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonPasien from '$lib/components/skeleton/DashboardSkeletonPasien.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { departmentStore } from '$lib/stores/department.svelte';
	import {
		patientAppointmentStore,
		fetchAppointments,
		fetchSchedules,
		createAppointment,
		cancelAppointment,
		type DoctorSchedule,
		type ScheduleSlot,
		type PatientAppointment
	} from '$lib/stores/patientAppointment.svelte';

	import {
		patientPrescriptionStore,
		fetchPrescriptions,
		type PatientPrescription
	} from '$lib/stores/patientPrescription.svelte';
	import {
		patientFamilyStore,
		fetchFamilyMembers,
		createFamilyMember,
		updateFamilyMember,
		deleteFamilyMember,
		type PatientFamilyMember
	} from '$lib/stores/patientFamily.svelte';

	let isLoading = $state(true);
	let isForbidden = $state(false);

	let currentUser = $state<{ role: string; name: string; id: string; user_code?: string }>({
		role: 'pasien',
		name: '',
		id: '',
		user_code: ''
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// --- STATE JANJI TEMU REAL API ---
	let selectedStatusFilter = $state<string>('ALL');
	let expandedAppointmentId = $state<string | null>(null);

	// Modal Buat Janji State
	let showApptModal = $state(false);
	let searchDeptId = $state('');
	let searchDate = $state('');
	let searchQuery = $state('');
	let selectedSlotId = $state('');
	let selectedSlotInfo = $state<{
		doctorName: string;
		deptName: string;
		date: string;
		slotName: string;
		time: string;
		remainingQuota: number;
		maxPatient: number;
	} | null>(null);
	let bookingError = $state<string | null>(null);
	let bookingSuccessData = $state<any | null>(null);
	let showSuccessModal = $state(false);
	let isCancellingId = $state<string | null>(null);
	let selectedFamilyMemberId = $state('');
	let showFamilyForm = $state(false);
	let editingFamilyMemberId = $state<string | null>(null);
	let familyFormError = $state<string | null>(null);
	let familyForm = $state({ name: '', gender: '', age: 0, medicine_allergy: '' });
	let appoinmentInputs = $state({
		patient_id: '',
		complaint: '',
		detail_sympton: ''
	});

	function resetFamilyForm() {
		familyForm = { name: '', gender: '', age: 0, medicine_allergy: '' };
		editingFamilyMemberId = null;
		familyFormError = null;
	}

	function selectFamilyMember(member: PatientFamilyMember) {
		selectedFamilyMemberId = member.id;
		appoinmentInputs.patient_id = member.id;
	}

	function editFamilyMember(member: PatientFamilyMember) {
		editingFamilyMemberId = member.id;
		familyForm = { name: member.name, gender: member.gender, age: member.age, medicine_allergy: member.medicine_allergy };
		familyFormError = null;
		showFamilyForm = true;
	}

	async function saveFamilyMember(e: Event) {
		e.preventDefault();
		familyFormError = null;
		if (familyForm.name.trim().length < 3 || !familyForm.gender || familyForm.age < 0) {
			familyFormError = 'Nama, gender, dan umur wajib diisi dengan benar.';
			return;
		}
		try {
			const payload = { ...familyForm, name: familyForm.name.trim() };
			if (editingFamilyMemberId) await updateFamilyMember(editingFamilyMemberId, payload);
			else await createFamilyMember(payload);
			showFamilyForm = false;
			resetFamilyForm();
		} catch (err: any) {
			familyFormError = err.message || 'Gagal menyimpan data keluarga.';
		}
	}

	async function removeFamilyMember(member: PatientFamilyMember) {
		if (!confirm(`Hapus data ${member.name} dari keluarga?`)) return;
		try {
			await deleteFamilyMember(member.id);
			if (selectedFamilyMemberId === member.id) {
				selectedFamilyMemberId = '';
				appoinmentInputs = { patient_id: '', complaint: appoinmentInputs.complaint, detail_sympton: appoinmentInputs.detail_sympton };
			}
		} catch (err: any) {
			alert(err.message || 'Gagal menghapus data keluarga.');
		}
	}

	onMount(async () => {
		try {
			const profile = await validateSession();

			if (profile.role.toLowerCase() !== 'patient') {
				isForbidden = true;
			} else {
				currentUser = profile;
				userProfile.name = profile.name;
				await Promise.all([
					departmentStore.fetchDepartments({ is_active: 'true' }),
					fetchAppointments(),
					fetchSchedules(),
					fetchPrescriptions(),
					fetchFamilyMembers()
				]);
			}
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});

	function handleFilterStatusChange(status: string) {
		selectedStatusFilter = status;
		fetchAppointments({ status: status === 'ALL' ? undefined : status });
	}

	async function handleSearchSchedules() {
		selectedSlotId = '';
		selectedSlotInfo = null;
		bookingError = null;
		await fetchSchedules({
			date: searchDate || undefined,
			departmen_id: searchDeptId || undefined,
			search: searchQuery.trim() || undefined
		});
	}

	function resetSearchFilters() {
		searchDeptId = '';
		searchDate = '';
		searchQuery = '';
		selectedSlotId = '';
		selectedSlotInfo = null;
		bookingError = null;
		appoinmentInputs.complaint = '';
		fetchSchedules();
	}

	function selectSlot(doc: DoctorSchedule, slot: ScheduleSlot) {
		if (slot.status_slot === 'CLOSED' || slot.remaining_quota <= 0 || !slot.is_active) {
			return;
		}
		selectedSlotId = slot.id;
		selectedSlotInfo = {
			doctorName: doc.doctor.name,
			deptName: doc.doctor.department?.name || 'Poliklinik',
			date: doc.practice_date,
			slotName: slot.name,
			time: `${slot.start_hour} - ${slot.end_hour} WIB`,
			remainingQuota: slot.remaining_quota,
			maxPatient: slot.max_patient
		};
		bookingError = null;
	}

	function openAddApptModal() {
		searchDeptId = '';
		searchDate = '';
		searchQuery = '';
		selectedSlotId = '';
		selectedSlotInfo = null;
		bookingError = null;
		selectedFamilyMemberId = '';
		appoinmentInputs = { patient_id: '', complaint: '', detail_sympton: '' };
		appoinmentInputs.complaint = '';
		showApptModal = true;
		fetchSchedules();
	}

	async function handleBookAppointment(e: Event) {
		e.preventDefault();
		if (!selectedSlotId || !selectedFamilyMemberId) {
			bookingError = 'Pilih anggota keluarga dari daftar pasien terlebih dahulu.';
			return;
		}

		bookingError = null;

		try {
			const res = await createAppointment(selectedSlotId, appoinmentInputs);
					bookingSuccessData = res.data;
					// Clear inputs after successful booking
					appoinmentInputs = {
						patient_id: '',
						complaint: '',
						detail_sympton: ''
					};
					showApptModal = false;
					showSuccessModal = true;
		} catch (err: any) {
			bookingError = err.message || 'Gagal membuat janji temu.';
		}
	}

	async function handleCancelAppointment(appointmentId: string) {
		if (!confirm('Apakah Anda yakin ingin membatalkan janji temu ini?')) return;

		isCancellingId = appointmentId;

		try {
			await cancelAppointment(appointmentId);
			alert('Janji temu berhasil dibatalkan.');
		} catch (err: any) {
			alert('Gagal membatalkan janji temu: ' + (err.message || 'Terjadi kesalahan'));
		} finally {
			isCancellingId = null;
		}
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '-';
		try {
			const dateObj = new Date(dateStr.split('T')[0]);
			return dateObj.toLocaleDateString('id-ID', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function getTodayDate(): string {
		const today = new Date();
		return today.toISOString().split('T')[0];
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'CONFIRMED':
				return 'bg-emerald-100 text-emerald-800 border-emerald-300';
			case 'COMPLETED':
				return 'bg-sky-100 text-sky-800 border-sky-300';
			case 'CANCELLED':
				return 'bg-rose-100 text-rose-800 border-rose-300';
			case 'PENDING':
			default:
				return 'bg-amber-100 text-amber-800 border-amber-300';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'CONFIRMED':
				return 'Terjadwal';
			case 'COMPLETED':
				return 'Selesai';
			case 'CANCELLED':
				return 'Dibatalkan';
			case 'PENDING':
			default:
				return 'Menunggu Konfirmasi';
		}
	}

	function getPrescriptionStatusBadgeClass(status: string): string {
		switch (status) {
			case 'CONFIRMED':
				return 'bg-emerald-100 text-emerald-800 border-emerald-300';
			case 'COMPLETED':
				return 'bg-sky-100 text-sky-800 border-sky-300';
			case 'CANCELLED':
				return 'bg-rose-100 text-rose-800 border-rose-300';
			case 'PENDING':
			default:
				return 'bg-amber-100 text-amber-800 border-amber-300';
		}
	}

	function getPrescriptionStatusLabel(status: string): string {
		switch (status) {
			case 'CONFIRMED':
				return 'Siap Ambil di Loket Apotek';
			case 'COMPLETED':
				return 'Selesai';
			case 'CANCELLED':
				return 'Dibatalkan';
			case 'PENDING':
			default:
				return 'Sedang Diracik Apoteker';
		}
	}

	// --- STATE MENU PENGATURAN (PASIEN) ---
	let userProfile = $state({
		name: currentUser.name,
		email: 'ayu.putri@email.com',
		phone: '0812-3456-7890',
		address: 'Jl. Pemuda No. 45, Kudus, Jawa Tengah',
		bloodType: 'O',
		allergies: 'Penisilin, Seafood'
	});

	let notifSettings = $state({
		whatsapp: true,
		email: true,
		sms: false
	});

	function saveProfileChanges(e: Event) {
		e.preventDefault();
		alert('Perubahan profil berhasil disimpan!');
	}
</script>

<Title title="Pasien | Dashboard" />

<div class="flex h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="pasien"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(m) => (activeMenu = m)}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex h-full flex-1 flex-col overflow-hidden">
		{#if !isForbidden}
			<header
				class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden"
			>
				<!-- svelte-ignore a11y_consider_explicit_label -->
				<button onclick={() => (isSidebarOpen = true)} class="text-sky-600">
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
		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10' : ''}>
			{#if isLoading}
				<DashboardSkeletonPasien />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- HEADER HERO PASIEN -->
				<div
					class="relative mb-6 overflow-hidden rounded-[24px] bg-gradient-to-r from-sky-600 to-cyan-500 p-6 text-white shadow-lg sm:p-8"
				>
					<div class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl"></div>
					<div
						class="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
					>
						<div>
							<h1 class="text-3xl font-black sm:text-4xl">
								Selamat Datang, {currentUser.name}! 🌟
							</h1>
							<p class="mt-2 text-sky-50">
								Semoga hari Anda sehat selalu. Berikut adalah ringkasan medis Anda.
							</p>
						</div>
						<div class="rounded-2xl border border-white/20 bg-white/15 px-5 py-3 backdrop-blur-md">
							<p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">
								Data Keluarga
							</p>
							<p class="mt-0.5 text-xl font-black tracking-wider text-white">
								{patientFamilyStore.members.length} Anggota
							</p>
							<p class="mt-0.5 text-[11px] font-medium text-sky-100">Siap untuk pendaftaran janji temu</p>
						</div>
					</div>
				</div>

				<!-- SMART ALERTS -->
				<div class="mb-8 space-y-3">
					{#if patientAppointmentStore.appointments.some((a) => a.status === 'PENDING' || a.status === 'CONFIRMED')}
						{@const upcoming = patientAppointmentStore.appointments.find(
							(a) => a.status === 'PENDING' || a.status === 'CONFIRMED'
						)}
						<div
							class="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white"
								>
									<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										></path>
									</svg>
								</div>
								<div>
									<p class="text-sm font-bold text-sky-900">Pengingat Jadwal Kunjungan</p>
									<p class="text-xs font-medium text-sky-700">
										Anda memiliki janji temu dengan <strong
											>{upcoming?.doctor?.name || 'Dokter'}</strong
										>
										({upcoming?.doctor?.department?.name || 'Poli'}) - Antrean #{upcoming?.queue_number}.
									</p>
								</div>
							</div>
							<button
								onclick={() => (activeMenu = 'janji')}
								class="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-700"
							>
								Lihat Detail
							</button>
						</div>
					{/if}

					{#if patientPrescriptionStore.activePrescriptions.some((rx) => rx.status === 'CONFIRMED' || rx.is_ready)}
						<div
							class="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"
								>
									<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
										></path>
									</svg>
								</div>
								<div>
									<p class="text-sm font-bold text-emerald-900">Obat Anda Sudah Siap!</p>
									<p class="text-xs font-medium text-emerald-700">
										Silakan menuju Loket Apotek untuk mengambil obat racikan Anda.
									</p>
								</div>
							</div>
							<button
								onclick={() => (activeMenu = 'resep')}
								class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
							>
								Lihat Resep
							</button>
						</div>
					{/if}
				</div>

				<!-- ===================== -->
				<!-- MENU 1: BERANDA       -->
				<!-- ===================== -->
				{#if activeMenu === 'beranda'}
					<div class="grid gap-6 lg:grid-cols-2">
						<!-- KIRI: KARTU JADWAL -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							<div class="mb-5 flex items-center justify-between">
								<h2 class="text-lg font-bold text-slate-900">Jadwal Mendatang</h2>
								<button
									onclick={() => (activeMenu = 'janji')}
									class="text-sm font-bold text-sky-600"
								>
									Lihat Semua &rarr;
								</button>
							</div>

							{#if patientAppointmentStore.isLoadingAppointments}
								<div class="flex items-center justify-center py-8">
									<div
										class="h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
									></div>
								</div>
							{:else if patientAppointmentStore.appointments.length === 0}
								<div
									class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400"
								>
									Belum ada janji temu mendatang.
								</div>
							{:else}
								<div class="space-y-4">
									{#each patientAppointmentStore.appointments.slice(0, 3) as appt, appointmentIndex (appt.id ?? `upcoming-${appointmentIndex}`)}
										<div
											class={`rounded-xl border p-4 ${appt.status === 'CONFIRMED' || appt.status === 'PENDING' ? 'border-sky-500 bg-sky-50/50 shadow-sm' : 'border-slate-100 bg-slate-50'}`}
										>
											<div class="flex items-center justify-between">
												<p class="font-black text-slate-900">
													{appt.doctor?.department?.name || 'Poliklinik'}
												</p>
												<span
													class="rounded border px-2 py-0.5 text-[10px] font-black uppercase {getStatusBadgeClass(
														appt.status
													)}"
												>
													{getStatusLabel(appt.status)}
												</span>
											</div>
											<p class="mt-1 text-sm font-medium text-slate-600">
												{appt.doctor?.name || 'Dokter MedSync'}
											</p>
											<div
												class="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"
											>
												<span class="flex items-center gap-1"
													>📅 {formatDate(appt.practice_date)}</span
												>
												<span class="flex items-center gap-1"
													>⏰ {appt.slot ? `${appt.slot.start_hour} - ${appt.slot.end_hour}` : ''} WIB</span
												>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</section>

						<!-- KANAN: STATUS OBAT & REKAM MEDIS -->
						<aside class="space-y-6">
							<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<div class="mb-4 flex items-center justify-between">
									<h2 class="text-lg font-bold text-slate-900">Pengobatan Saat Ini</h2>
									<button
										onclick={() => (activeMenu = 'resep')}
										class="text-xs font-bold text-sky-600 hover:underline"
									>
										Detail &rarr;
									</button>
								</div>
								<div class="space-y-3">
									{#if patientPrescriptionStore.isLoading}
										<div class="flex items-center justify-center py-6">
											<div
												class="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
											></div>
										</div>
									{:else if patientPrescriptionStore.activePrescriptions.length === 0}
										<div
											class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400"
										>
											Tidak ada pengobatan resep aktif.
										</div>
									{:else}
										{#each patientPrescriptionStore.activePrescriptions as rx, prescriptionIndex (rx.id ?? `prescription-${prescriptionIndex}`)}
											{#each rx.medicines as med, medicineIndex (`${rx.id ?? `prescription-${prescriptionIndex}`}-${med.id ?? med.name ?? medicineIndex}`)}
												<div
													class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
												>
													<div>
														<p class="text-sm font-bold text-slate-900">{med.name}</p>
														<p class="text-xs text-sky-700">💊 {med.rules_using}</p>
													</div>
													<span
														class={`rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider uppercase ${rx.status === 'CONFIRMED' || rx.is_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
													>
														{getPrescriptionStatusLabel(rx.status)}
													</span>
												</div>
											{/each}
										{/each}
									{/if}
								</div>
							</div>

							<div class="rounded-[24px] bg-slate-900 p-6 text-white shadow-lg">
								<h2 class="mb-4 text-lg font-bold">Catatan Dokter (Terbaru)</h2>
								{#each patientAppointmentStore.appointments.filter((appointment) => appointment.appointment?.doctor_assesment) as update, updateIndex (update.appointment?.id ?? `doctor-note-${updateIndex}`)}
									<div class="rounded-xl border border-white/10 bg-white/10 p-4">
										<div class="mb-2 flex items-center justify-between">
											<p class="font-bold text-sky-300">
												{update.appointment?.doctor_assesment?.assesment || 'Assessment dokter'}
											</p>
											<p class="text-[10px] text-slate-400">{formatDate(update.practice_date)}</p>
										</div>
										<p class="text-sm leading-relaxed text-slate-200">
											Plan: {update.appointment?.doctor_assesment?.plan || 'Belum ada plan dokter.'}
										</p>
										<p class="text-xs font-bold italic leading-relaxed text-slate-200">
											Catatan: {update.appointment?.doctor_assesment?.notes || 'Belum ada catatan dokter.'}
										</p>
										<p class="mt-3 text-xs text-slate-400">
											Pemeriksa: {update.doctor?.name || 'Dokter MedSync'}
										</p>
										<div class="my-3 border-t border-white/15"></div>
										<div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
											<div>
												<span class="text-slate-500">Kode pasien</span>
												<p class="font-semibold text-white">{update.patient?.patient_code || '-'}</p>
											</div>
											<div>
												<span class="text-slate-500">Nama</span>
												<p class="font-semibold text-white">{update.patient?.name || '-'}</p>
											</div>
											<div>
												<span class="text-slate-500">Umur</span>
												<p class="font-semibold text-white">{update.patient?.age ?? '-'} tahun</p>
											</div>
											<div>
												<span class="text-slate-500">Gender</span>
												<p class="font-semibold text-white">{update.patient?.gender || '-'}</p>
											</div>
										</div>
									</div>
								{:else}
									<div class="rounded-xl border border-white/10 bg-white/10 p-4 text-sm text-slate-400">
										Belum ada catatan dokter.
									</div>
								{/each}
							</div>
						</aside>
					</div>

					<!-- =========================== -->
					<!-- MENU 2: JANJI TEMU (PASIEN) -->
					<!-- =========================== -->
				{:else if activeMenu === 'keluarga'}
					<div class="space-y-6">
						<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 class="text-xl font-bold text-slate-900">Data Keluarga</h2>
									<p class="mt-1 text-sm text-slate-500">Simpan identitas keluarga untuk mempercepat pendaftaran janji temu.</p>
								</div>
								<button
									type="button"
									onclick={() => { resetFamilyForm(); showFamilyForm = true; }}
									class="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700"
								>
									+ Tambah Keluarga
								</button>
							</div>

							{#if patientFamilyStore.error && !showFamilyForm}
								<div class="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{patientFamilyStore.error}</div>
							{/if}
							{#if patientFamilyStore.isLoading}
								<div class="py-12 text-center text-sm text-slate-500">Memuat data keluarga...</div>
							{:else if patientFamilyStore.members.length === 0}
								<div class="mt-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
									<p class="text-3xl">👨‍👩‍👧</p>
									<p class="mt-2 font-bold text-slate-700">Belum ada data keluarga</p>
									<p class="mt-1 text-xs text-slate-400">Tambahkan identitas keluarga agar proses booking lebih cepat.</p>
								</div>
							{:else}
								<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{#each patientFamilyStore.members as member (member.id)}
										<article class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
											<div class="flex items-start justify-between gap-3">
												<div>
													<p class="font-bold text-slate-900">{member.name}</p>
													<p class="mt-1 text-xs font-semibold text-sky-700">{member.gender} · {member.age} tahun</p>
												</div>
												<span class="rounded-lg bg-white px-2 py-1 text-lg">👤</span>
											</div>
											<p class="mt-4 min-h-10 text-xs text-slate-500">Alergi obat: {member.medicine_allergy || 'Tidak ada catatan'}</p>
											<div class="mt-4 flex gap-2 border-t border-slate-200 pt-3">
												<button type="button" onclick={() => editFamilyMember(member)} class="text-xs font-bold text-sky-600 hover:underline">Edit</button>
												<button type="button" onclick={() => removeFamilyMember(member)} class="text-xs font-bold text-rose-600 hover:underline">Hapus</button>
											</div>
										</article>
									{/each}
								</div>
							{/if}
						</section>
					</div>

					{#if showFamilyForm}
						<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
							<form onsubmit={saveFamilyMember} class="w-full max-w-lg space-y-5 rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
								<div class="flex items-center justify-between">
									<div>
										<h2 class="text-xl font-bold text-slate-900">{editingFamilyMemberId ? 'Edit Data Keluarga' : 'Tambah Data Keluarga'}</h2>
										<p class="mt-1 text-sm text-slate-500">Data ini tersimpan sebagai identitas pasien di backend.</p>
									</div>
									<button type="button" onclick={() => (showFamilyForm = false)} class="text-xl text-slate-400 hover:text-slate-700" aria-label="Tutup">✕</button>
								</div>
								{#if familyFormError}
									<div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{familyFormError}</div>
								{/if}
								<label class="block text-sm font-semibold text-slate-700">Nama
									<input bind:value={familyForm.name} required minlength="3" class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Nama lengkap" />
								</label>
								<div class="grid gap-4 sm:grid-cols-2">
									<label class="block text-sm font-semibold text-slate-700">Gender
										<select bind:value={familyForm.gender} required class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
											<option value="" disabled>Pilih gender</option>
											<option value="LAKILAKI">Laki-laki</option>
											<option value="PEREMPUAN">Perempuan</option>
										</select>
									</label>
									<label class="block text-sm font-semibold text-slate-700">Umur
										<input bind:value={familyForm.age} required type="number" min="0" max="150" class="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Umur" />
									</label>
								</div>
								<label class="block text-sm font-semibold text-slate-700">Alergi obat
									<textarea bind:value={familyForm.medicine_allergy} rows="3" class="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Tulis alergi obat atau 'Tidak ada'"></textarea>
								</label>
								<div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
									<button type="button" onclick={() => (showFamilyForm = false)} class="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
									<button type="submit" disabled={patientFamilyStore.isSubmitting} class="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{patientFamilyStore.isSubmitting ? 'Menyimpan...' : 'Simpan Data'}</button>
								</div>
							</form>
						</div>
					{/if}

					<!-- =========================== -->
					<!-- MENU 3: JANJI TEMU (PASIEN) -->
					<!-- =========================== -->
				{:else if activeMenu == 'janji'}
					<div class="space-y-6">
						<!-- Banner Atas / Aksi Buat Janji -->
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-sky-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Kelola Janji Temu Dokter</h2>
								<p class="mt-1 text-sm text-slate-500">
									Cari jadwal praktek dokter, pilih slot waktu yang tersedia, dan pantau antrean
									Anda.
								</p>
							</div>
							<button
								onclick={openAddApptModal}
								class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90"
							>
								<span>➕</span> Buat Janji Temu Baru
							</button>
						</div>

						<!-- Filter Status Tabs -->
						<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
							<button
								onclick={() => handleFilterStatusChange('ALL')}
								class="rounded-xl px-4 py-2 text-xs font-bold transition-all {selectedStatusFilter ===
								'ALL'
									? 'bg-sky-600 text-white shadow-md'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
							>
								Semua
							</button>
							<button
								onclick={() => handleFilterStatusChange('PENDING')}
								class="rounded-xl px-4 py-2 text-xs font-bold transition-all {selectedStatusFilter ===
								'PENDING'
									? 'bg-amber-500 text-white shadow-md'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
							>
								Menunggu Konfirmasi
							</button>
							<button
								onclick={() => handleFilterStatusChange('CONFIRMED')}
								class="rounded-xl px-4 py-2 text-xs font-bold transition-all {selectedStatusFilter ===
								'CONFIRMED'
									? 'bg-emerald-600 text-white shadow-md'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
							>
								Terjadwal
							</button>
							<button
								onclick={() => handleFilterStatusChange('COMPLETED')}
								class="rounded-xl px-4 py-2 text-xs font-bold transition-all {selectedStatusFilter ===
								'COMPLETED'
									? 'bg-sky-600 text-white shadow-md'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
							>
								Selesai
							</button>
							<button
								onclick={() => handleFilterStatusChange('CANCELLED')}
								class="rounded-xl px-4 py-2 text-xs font-bold transition-all {selectedStatusFilter ===
								'CANCELLED'
									? 'bg-rose-600 text-white shadow-md'
									: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
							>
								Dibatalkan
							</button>
						</div>

						<!-- List Janji Temu -->
						{#if patientAppointmentStore.isLoadingAppointments}
							<div class="flex flex-col items-center justify-center py-12">
								<div
									class="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"
								></div>
								<p class="mt-3 text-sm font-medium text-slate-500">
									Memuat daftar janji temu Anda...
								</p>
							</div>
						{:else if patientAppointmentStore.error}
							<div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
								<p class="text-sm font-bold text-rose-600">❌ {patientAppointmentStore.error}</p>
								<button
									onclick={() =>
										fetchAppointments({
											status: selectedStatusFilter === 'ALL' ? undefined : selectedStatusFilter
										})}
									class="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
								>
									Coba Lagi
								</button>
							</div>
						{:else if patientAppointmentStore.appointments.length === 0}
							<div
								class="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400"
							>
								<p class="mb-2 text-3xl">📅</p>
								<p class="font-bold text-slate-600">
									Belum ada janji temu {selectedStatusFilter !== 'ALL'
										? `dengan status ${getStatusLabel(selectedStatusFilter)}`
										: ''}.
								</p>
								<p class="mt-1 text-xs text-slate-400">
									Klik tombol "Buat Janji Temu Baru" untuk memilih jadwal dokter.
								</p>
							</div>
						{:else}
							<div class="grid gap-5 md:grid-cols-2">
								{#each patientAppointmentStore.appointments as item, appointmentIndex (item.id ?? `appointment-${appointmentIndex}`)}
									<div
										class="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300"
									>
										<div>
											<!-- Header Kartu -->
											<div class="flex items-center justify-between border-b border-slate-100 pb-3">
												<div class="flex items-center gap-2">
													<span
														class="rounded-lg bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
													>
														{item.doctor?.department?.name || 'Poliklinik'}
													</span>
													<span
														class="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white"
													>
														Antrean #{item.queue_number}
													</span>
												</div>
												<span
													class="rounded-lg border px-2.5 py-1 text-[10px] font-black tracking-wider uppercase {getStatusBadgeClass(
														item.status
													)}"
												>
													{getStatusLabel(item.status)}
												</span>
											</div>

											<!-- Info Dokter & Waktu -->
											<div class="mt-4 space-y-2">
												<p class="text-xl font-bold text-slate-900">
													{item.doctor?.name || 'Dokter MedSync'}
												</p>
												<p class="flex items-center gap-2 text-sm font-semibold text-slate-600">
													<span>📅</span>
													{formatDate(item.practice_date)} &nbsp;|&nbsp; <span>⏰</span>
													{item.slot
														? `${item.slot.start_hour} - ${item.slot.end_hour} WIB`
														: 'Jam Praktik'}
												</p>
												{#if item.doctor?.department?.address || item.doctor?.department?.city}
													<p class="flex items-center gap-2 text-xs font-medium text-slate-400">
														<span>📍</span>
														{item.doctor.department.address || ''}
														{item.doctor.department.city ? `, ${item.doctor.department.city}` : ''}
													</p>
												{/if}
											</div>
										</div>

										<!-- Footer Tombol Aksi -->
										<div
											class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"
										>
											<span class="text-xs font-bold text-slate-400">Kode Pasien: {item.patient?.patient_code}</span>
											<div class="flex gap-2">
													{#if item.appointment?.status === 'COMPLETED'}
														<button
															type="button"
															onclick={() => (expandedAppointmentId = expandedAppointmentId === item.patient?.patient_code ? null : item.patient?.patient_code)}
															class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
														>
															{expandedAppointmentId === item.patient?.patient_code ? 'Tutup Hasil Pemeriksaan' : 'Lihat Hasil Pemeriksaan'}
														</button>
													{/if}
												{#if item.appointment?.status === 'PENDING' || item.appointment?.status === 'CONFIRMED'}
													<button
														disabled={isCancellingId === item.appointment?.id}
														onclick={() => handleCancelAppointment(item.appointment?.id)}
														class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
													>
														{isCancellingId === item.appointment?.id ? 'Membatalkan...' : 'Batalkan Janji'}
													</button>
												{/if}
											</div>
										</div>

											{#if item.appointment?.status === 'COMPLETED' && expandedAppointmentId === item.patient?.patient_code}
												<div class="mt-4 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
													<div class="grid gap-3 sm:grid-cols-2">
														<div class="rounded-xl border border-amber-100 bg-amber-50 p-3">
															<p class="font-bold text-amber-900">Subjective / Keluhan</p>
															<p class="mt-1 leading-relaxed text-slate-700">{item.appointment?.complaint || 'Tidak ada keluhan tercatat.'}</p>
														</div>
														<div class="rounded-xl border border-sky-100 bg-sky-50 p-3">
															<p class="font-bold text-sky-900">Objective / Tanda Vital</p>
															<p class="mt-1 leading-relaxed text-slate-700">
																TD {item.appointment?.nurse_assesment?.sistolic ?? '-'} / {item.appointment?.nurse_assesment?.diastolic ?? '-'} mmHg, Nadi {item.appointment?.nurse_assesment?.heart_rate ?? '-'} bpm, RR {item.appointment?.nurse_assesment?.respiratory_rate ?? '-'}x/menit, Suhu {item.appointment?.nurse_assesment?.temperature ?? '-'}°C, BB {item.appointment?.nurse_assesment?.weight ?? '-'} kg, TB {item.appointment?.nurse_assesment?.height ?? '-'} cm
															</p>
														</div>
													</div>
													<div class="grid gap-3 sm:grid-cols-3">
														<div class="rounded-xl border border-indigo-100 bg-indigo-50 p-3"><p class="font-bold text-indigo-900">Assessment</p><p class="mt-1 text-slate-700">{item.appointment?.doctor_assesment?.assesment || 'Belum diisi.'}</p></div>
														<div class="rounded-xl border border-emerald-100 bg-white p-3"><p class="font-bold text-emerald-900">Plan</p><p class="mt-1 text-slate-700">{item.appointment?.doctor_assesment?.plan || 'Belum diisi.'}</p></div>
														<div class="rounded-xl border border-slate-200 bg-white p-3"><p class="font-bold text-slate-800">Catatan Dokter</p><p class="mt-1 text-slate-700">{item.appointment?.doctor_assesment?.notes || 'Belum diisi.'}</p></div>
													</div>
												</div>
											{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- MODAL FORM BUAT JANJI TEMU PASIEN -->
					{#if showApptModal}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
							onkeydown={(e) => e.key === 'Escape' && (showApptModal = false)}
						>
							<div
								class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-7 shadow-2xl sm:p-8"
							>
								<!-- Header Modal -->
								<div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-5">
									<div>
										<h2 class="text-xl font-bold text-slate-900">Buat Janji Temu Baru</h2>
										<p class="mt-1 text-sm text-slate-500">
											Filter dokter berdasarkan poliklinik atau tanggal, lalu pilih slot jadwal yang
											tersedia.
										</p>
									</div>
									<button
										type="button"
										onclick={() => (showApptModal = false)}
										class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
									>
										✕
									</button>
								</div>

								<!-- Filter Search Bar inside Modal -->
								<div class="mb-6 space-y-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
									<div class="grid gap-4 sm:grid-cols-3">
										<!-- Filter Poliklinik -->
										<label class="block">
											<span
												class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>
												Poliklinik
											</span>
											<select
												bind:value={searchDeptId}
												onchange={handleSearchSchedules}
												class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											>
												<option value="">— Semua Poliklinik —</option>
												{#each departmentStore.list as dept (dept.id)}
													<option value={dept.id}>{dept.name}</option>
												{/each}
											</select>
										</label>

										<!-- Filter Tanggal -->
										<label class="block">
											<span
												class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>
												Tanggal Praktik
											</span>
											<input
												type="date"
												bind:value={searchDate}
												onchange={handleSearchSchedules}
												min={getTodayDate()}
												class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											/>
										</label>

										<!-- Search Keyword -->
										<label class="block">
											<span
												class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>
												Cari Dokter / Poli
											</span>
											<div class="relative flex items-center">
												<input
													type="text"
													bind:value={searchQuery}
													oninput={handleSearchSchedules}
													placeholder="Ketik nama dokter..."
													class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
												/>
												{#if searchQuery}
													<button
														type="button"
														onclick={() => {
															searchQuery = '';
															handleSearchSchedules();
														}}
														class="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600"
													>
														✕
													</button>
												{/if}
											</div>
										</label>
									</div>

									<div class="flex items-center justify-between pt-1">
										<p class="text-xs text-slate-500">
											Menampilkan jadwal aktif yang memiliki kuota antrean pasien.
										</p>
										{#if searchDeptId || searchDate || searchQuery}
											<button
												type="button"
												onclick={resetSearchFilters}
												class="text-xs font-bold text-sky-600 hover:underline"
											>
												Reset Filter
											</button>
										{/if}
									</div>
								</div>

								<!-- Error Alert inside Modal -->
								{#if bookingError}
									<div
										class="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"
									>
										<span>⚠️</span>
										<div class="flex-1">{bookingError}</div>
									</div>
								{/if}

								<!-- Pilih identitas pasien untuk appointment -->
								<div class="mb-6 rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
									<div class="mb-3 flex items-center justify-between">
										<div>
											<p class="text-sm font-bold text-slate-800">Untuk siapa janji temu ini?</p>
											<p class="mt-1 text-xs text-slate-500">Pilih pasien keluarga dari data yang tersimpan.</p>
										</div>
										<button type="button" onclick={() => { activeMenu = 'keluarga'; showApptModal = false; }} class="text-xs font-bold text-sky-600 hover:underline">Kelola keluarga</button>
									</div>
									<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{#each patientFamilyStore.members as member (member.id)}
											<button
												type="button"
												onclick={() => selectFamilyMember(member)}
												class="rounded-xl border-2 p-3 text-left transition {selectedFamilyMemberId === member.id ? 'border-sky-500 bg-white shadow-sm' : 'border-transparent bg-white hover:border-sky-200'}"
											>
												<p class="text-sm font-bold text-slate-900">{member.name}</p>
												<p class="mt-1 text-xs text-slate-500">{member.gender} · {member.age} tahun</p>
											</button>
										{/each}
									</div>
									{#if patientFamilyStore.members.length === 0}
										<p class="mt-3 text-xs font-semibold text-amber-700">Belum ada data pasien keluarga. Tambahkan data melalui menu Kelola keluarga.</p>
									{/if}
								</div>

								<!-- Schedule List Results -->
								<div class="space-y-6">
									{#if patientAppointmentStore.isLoadingSchedules}
										<div class="flex flex-col items-center justify-center py-10">
											<div
												class="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"
											></div>
											<p class="mt-2 text-xs font-medium text-slate-500">
												Memuat daftar jadwal praktek dokter...
											</p>
										</div>
									{:else if patientAppointmentStore.schedules.length === 0}
										<div
											class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center"
										>
											<p class="text-2xl">🏥</p>
											<p class="mt-2 text-sm font-bold text-slate-600">
												Tidak ada jadwal dokter yang sesuai filter
											</p>
											<p class="mt-1 text-xs text-slate-400">
												Coba ubah tanggal atau pilih poliklinik lain.
											</p>
										</div>
									{:else}
										{#each patientAppointmentStore.schedules as doc (doc.id)}
											{@const isAllClosed = doc.slots.filter(
												(item) => item.status_slot === 'CLOSED'
											)}
											{#if !(doc.slots.length === isAllClosed.length)}
												<div
													class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
												>
													<!-- Header Dokter -->
													<div
														class="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between"
													>
														<div>
															<div class="flex items-center gap-2">
																<span
																	class="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800 uppercase"
																>
																	{doc.doctor.department?.name || 'Poliklinik'}
																</span>
																{#if doc.doctor.staff_code}
																	<span class="text-xs font-bold text-slate-400">
																		Kode: {doc.doctor.staff_code}
																	</span>
																{/if}
															</div>
															<h3 class="mt-1 text-lg font-bold text-slate-900">
																{doc.doctor.name}
															</h3>
														</div>
														<div
															class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
														>
															📅 {formatDate(doc.practice_date)}
														</div>
													</div>

													<!-- Grid Slot Praktik Dokter -->
													<div>
														<p
															class="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase"
														>
															Pilih Slot Sesi Praktik:
														</p>
														<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
															{#each doc.slots as slot (slot.id)}
																{@const isFull =
																	slot.status_slot === 'CLOSED' ||
																	slot.remaining_quota <= 0 ||
																	!slot.is_active}
																{@const isSelected = selectedSlotId === slot.id}
																<button
																	type="button"
																	disabled={isFull}
																	onclick={() => selectSlot(doc, slot)}
																	class="relative flex flex-col justify-between rounded-xl border-2 p-3 text-left transition-all {isFull
																		? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-75'
																		: isSelected
																			? 'border-sky-500 bg-sky-50 shadow-md ring-2 shadow-sky-100 ring-sky-200'
																			: 'border-slate-200 bg-white text-slate-800 hover:border-sky-300 hover:shadow-sm'}"
																>
																	<div class="flex items-center justify-between">
																		<span class="text-xs font-black text-slate-700 uppercase"
																			>{slot.name}</span
																		>
																		{#if isFull}
																			<span
																				class="rounded bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700 uppercase"
																			>
																				FULL / Ditutup
																			</span>
																		{:else if isSelected}
																			<span
																				class="rounded-full bg-sky-600 px-2 py-0.5 text-[9px] font-black text-white"
																			>
																				✓ Dipilih
																			</span>
																		{:else}
																			<span
																				class="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800 uppercase"
																			>
																				OPEN
																			</span>
																		{/if}
																	</div>

																	<div class="mt-2 space-y-1">
																		<p class="text-sm font-bold text-slate-900">
																			⏰ {slot.start_hour} - {slot.end_hour} WIB
																		</p>
																		<p
																			class="text-xs font-medium {isFull
																				? 'text-slate-400'
																				: 'text-emerald-600'}"
																		>
																			📊 Sisa Kuota: <strong>{slot.remaining_quota}</strong> / {slot.max_patient}
																			pasien
																		</p>
																	</div>
																</button>
															{/each}
														</div>
													</div>
												</div>
											{/if}
										{/each}
									{/if}
								</div>

								<!-- Summary Card for Selected Slot -->
								{#if selectedSlotInfo}
									<div
										class="mt-6 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 shadow-sm"
									>
										<div class="mb-3 flex items-center justify-between">
											<h3 class="flex items-center gap-2 text-sm font-bold text-emerald-900">
												<span>✅</span> Ringkasan Booking Janji Temu
											</h3>
											<span class="text-xs font-bold text-emerald-700"
												>Sisa Kuota: {selectedSlotInfo.remainingQuota}</span
											>
										</div>
										<div class="grid gap-2 text-sm sm:grid-cols-2">
											<div class="rounded-lg bg-white/90 p-3">
												<p class="text-[10px] font-bold text-slate-400 uppercase">Poliklinik</p>
												<p class="font-bold text-slate-900">{selectedSlotInfo.deptName}</p>
											</div>
											<div class="rounded-lg bg-white/90 p-3">
												<p class="text-[10px] font-bold text-slate-400 uppercase">Dokter</p>
												<p class="font-bold text-slate-900">{selectedSlotInfo.doctorName}</p>
											</div>
											<div class="rounded-lg bg-white/90 p-3">
												<p class="text-[10px] font-bold text-slate-400 uppercase">
													Tanggal Praktik
												</p>
												<p class="font-bold text-slate-900">
													📅 {formatDate(selectedSlotInfo.date)}
												</p>
											</div>
											<div class="rounded-lg bg-white/90 p-3">
												<p class="text-[10px] font-bold text-slate-400 uppercase">Sesi & Jam</p>
												<p class="font-bold text-slate-900">
													⏰ {selectedSlotInfo.slotName} ({selectedSlotInfo.time})
												</p>
											</div>
										</div>
									</div>

									<div class="mt-4">
										<label class="block">
											<span
												class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>
												Keluhan Medis
											</span>
											<textarea
												bind:value={appoinmentInputs.complaint}
												placeholder="Contoh: Demam tinggi sudah 3 hari, pusing berputar, dan lemas"
												rows="3"
												class="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											></textarea>
										</label>
									</div>
									<div class="mt-4">
										<label class="block">
											<span
												class="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase"
											>
												(Opsional) Detail Gejala
											</span>
											<textarea
												bind:value={appoinmentInputs.detail_sympton}
												placeholder="Jelaskan sejak kapan dirasakan, seberapa sering, apa yang memperparah atau meringankan, serta riwayat obat yang sudah diminum sebelumnya..."
												rows="3"
												class="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm transition outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											></textarea>
										</label>
									</div>
								{/if}

								<!-- Actions -->
								<div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
									<button
										type="button"
										onclick={() => (showApptModal = false)}
										class="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
									>
										Batal
									</button>
									<button
										type="button"
										onclick={handleBookAppointment}
										disabled={!selectedSlotId || !selectedFamilyMemberId || patientAppointmentStore.isSubmitting}
										class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
									>
										{patientAppointmentStore.isSubmitting
											? 'Memproses Booking...'
											: 'Konfirmasi & Booking Janji Temu'}
									</button>
								</div>
							</div>
						</div>
					{/if}

					<!-- SUCCESS BOOKING MODAL -->
					{#if showSuccessModal && bookingSuccessData}
						<div
							class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
						>
							<div class="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-2xl">
								<div
									class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600"
								>
									🎉
								</div>
								<h3 class="text-2xl font-black text-slate-900">Janji Temu Berhasil!</h3>
								<p class="mt-1 text-sm font-medium text-slate-500">
									Pendaftaran janji temu Anda telah masuk ke sistem MedSync.
								</p>

								<div
									class="my-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left"
								>
									<div class="mb-4 border-b border-emerald-200/60 pb-3 text-center">
										<p class="text-xs font-bold tracking-wider text-emerald-700 uppercase">
											Nomor Antrean Anda
										</p>
										<p class="mt-1 text-4xl font-black tracking-wider text-emerald-900">
											#{bookingSuccessData.queue_number}
										</p>
									</div>
									<div class="space-y-2 text-xs font-semibold text-slate-700">
										<div class="flex justify-between">
											<span class="text-slate-400">Dokter:</span>
											<span class="font-bold text-slate-900"
												>{bookingSuccessData.schedule?.doctor?.name || '-'}</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-slate-400">Poliklinik:</span>
											<span class="font-bold text-slate-900"
												>{bookingSuccessData.schedule?.doctor?.department?.name || '-'}</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-slate-400">Tanggal:</span>
											<span class="font-bold text-slate-900"
												>{formatDate(bookingSuccessData.schedule?.practice_date)}</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-slate-400">Jam Sesi:</span>
											<span class="font-bold text-slate-900"
												>{bookingSuccessData.schedule?.start_hour} - {bookingSuccessData.schedule
													?.end_hour} WIB</span
											>
										</div>
										<div class="flex justify-between">
											<span class="text-slate-400">Status:</span>
											<span
												class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
											>
												{getStatusLabel(bookingSuccessData.status)}
											</span>
										</div>
									</div>
								</div>

								<button
									onclick={() => {
										showSuccessModal = false;
										activeMenu = 'janji';
									}}
									class="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md hover:bg-sky-700"
								>
									Lihat Janji Temu Saya
								</button>
							</div>
						</div>
					{/if}

					<!-- ===================== -->
					<!-- MENU 3: RESEP OBAT (PASIEN) -->
					<!-- ===================== -->
				{:else if activeMenu == 'resep'}
					<div class="space-y-6">
						<!-- Header Informasi -->
						<div class="rounded-[24px] border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
							<h2 class="text-xl font-bold text-slate-900">Resep & Pengambilan Obat</h2>
							<p class="mt-1 text-sm text-slate-500">
								Pantau status peracikan obat dari dokter dan lihat riwayat tebus resep Anda.
							</p>
						</div>

						{#if patientPrescriptionStore.isLoading}
							<div class="flex flex-col items-center justify-center py-12">
								<div
									class="h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"
								></div>
								<p class="mt-3 text-sm font-medium text-slate-500">Memuat resep obat Anda...</p>
							</div>
						{:else if patientPrescriptionStore.error}
							<div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
								<p class="text-sm font-bold text-rose-600">❌ {patientPrescriptionStore.error}</p>
								<button
									onclick={() => fetchPrescriptions()}
									class="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
								>
									Coba Lagi
								</button>
							</div>
						{:else}
							<!-- Bagian 1: Resep Aktif -->
							<section class="space-y-4">
								<h3 class="text-lg font-bold text-slate-800">Status Resep Saat Ini</h3>

										{#each patientPrescriptionStore.activePrescriptions as rx, prescriptionIndex (rx.id ?? `prescription-${prescriptionIndex}`)}
									<div
										class={`overflow-hidden rounded-[24px] border transition-all ${rx.status === 'CONFIRMED' || rx.is_ready ? 'border-emerald-300 bg-emerald-50/40 shadow-md' : 'border-sky-200 bg-white shadow-sm'}`}
									>
										<div class="p-6 sm:p-7">
											<div
												class="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"
											>
												<div>
													<div class="mb-1 flex items-center gap-2">
														<span
															class={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider uppercase ${getPrescriptionStatusBadgeClass(rx.status)}`}
														>
															{getPrescriptionStatusLabel(rx.status)}
														</span>
														<span class="text-xs font-bold text-slate-400">TRX: {rx.no_trx}</span>
													</div>
													<h4 class="text-lg font-bold text-slate-900">
														Pemeriksaan oleh {rx.doctor?.name || 'Dokter'} ({rx.doctor
															?.department_name || 'Poli'})
													</h4>
													<p class="text-xs font-medium text-slate-500">
														Diresepkan pada {formatDate(rx.recipe_date_exec)}
													</p>
												</div>

												{#if rx.status === 'CONFIRMED' || rx.is_ready}
													<div
														class="rounded-2xl bg-emerald-600 px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm"
													>
														🎫 Silakan Ambil di Loket Apotek
													</div>
												{:else}
													<div
														class="rounded-2xl bg-sky-100 px-4 py-2.5 text-center text-xs font-bold text-sky-700"
													>
														⏳ Sedang Diracik Apoteker
													</div>
												{/if}
											</div>

											{#if rx.verify_notes}
												<div
													class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
												>
													<strong>Catatan Apoteker:</strong>
													{rx.verify_notes}
												</div>
											{/if}

											<!-- Daftar Detail Obat -->
											<div class="mt-4">
												<p class="mb-3 text-xs font-bold tracking-wider text-slate-400 uppercase">
													Daftar Obat & Aturan Pakai
												</p>
												<div class="grid gap-3 sm:grid-cols-2">
													{#each rx.medicines as med, medicineIndex (`${rx.id ?? `prescription-${prescriptionIndex}`}-${med.id ?? med.name ?? medicineIndex}`)}
														<div
															class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
														>
															<p class="font-bold text-slate-900">
																{med.name}
																{med.unit ? `(${med.unit})` : ''}
															</p>
															<p class="mt-1 text-xs font-semibold text-sky-700">
																💊 {med.rules_using}
															</p>
														</div>
													{/each}
												</div>
											</div>
										</div>
									</div>
								{:else}
									<div
										class="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-slate-400"
									>
										Tidak ada resep aktif saat ini.
									</div>
								{/each}
							</section>

							<!-- Bagian 2: Riwayat Pengobatan Terdahulu -->
							<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
								<h3 class="mb-5 text-lg font-bold text-slate-900">Riwayat Pengobatan Terdahulu</h3>

								{#if patientPrescriptionStore.historyPrescriptions.length === 0}
									<div
										class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400"
									>
										Belum ada riwayat pengobatan terdahulu.
									</div>
								{:else}
									<div class="space-y-4">
											{#each patientPrescriptionStore.historyPrescriptions as history, historyIndex (history.id ?? `history-${historyIndex}`)}
											<div
												class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"
											>
												<div>
													<div class="mb-1 flex items-center gap-2">
														<span
															class={`rounded px-2 py-0.5 text-[10px] font-bold ${getPrescriptionStatusBadgeClass(history.status)}`}
														>
															{getPrescriptionStatusLabel(history.status)}
														</span>
														<span class="text-xs font-semibold text-slate-400"
															>{formatDate(history.recipe_date_exec)}</span
														>
													</div>
													<p class="font-bold text-slate-900">{history.doctor?.name || 'Dokter'}</p>
													<p class="mt-2 text-xs font-medium text-slate-600">
														Obat: <span class="font-semibold text-slate-800">
															{history.medicines.map((m) => m.name).join(', ') || '-'}
														</span>
													</p>
												</div>
												<span class="text-xs font-bold text-slate-400">TRX: {history.no_trx}</span>
											</div>
										{/each}
									</div>
								{/if}
							</section>
						{/if}
					</div>

					<!-- ===================== -->
					<!-- MENU 4: PENGATURAN AKUN (PASIEN) -->
					<!-- ===================== -->
				{:else if activeMenu == 'pengaturan'}
					<div class="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
						<!-- Kiri: Form Informasi Pribadi & Medis -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<div class="mb-6 border-b border-slate-100 pb-4">
								<h2 class="text-xl font-bold text-slate-900">Informasi Pribadi & Medis</h2>
								<p class="text-sm text-slate-500">
									Perbarui data diri dan riwayat medis ringkas Anda.
								</p>
							</div>

							<form onsubmit={saveProfileChanges} class="space-y-5">
								<div class="grid gap-5 md:grid-cols-2">
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Nama Lengkap</span>
										<input
											bind:value={userProfile.name}
											required
											class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
										/>
									</label>
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">
											Nomor Rekam Medis (ID)
										</span>
										<input
											value={currentUser.id}
											disabled
											class="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400 outline-none"
										/>
									</label>
								</div>

								<div class="grid gap-5 md:grid-cols-2">
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Alamat Email</span>
										<input
											type="email"
											bind:value={userProfile.email}
											required
											class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
										/>
									</label>
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">
											Nomor Telepon / WhatsApp
										</span>
										<input
											type="tel"
											bind:value={userProfile.phone}
											required
											class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
										/>
									</label>
								</div>

								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">
										Alamat Tempat Tinggal
									</span>
									<textarea
										bind:value={userProfile.address}
										rows="2"
										class="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									></textarea>
								</label>

								<div class="my-6 border-t border-slate-100 pt-4">
									<h3 class="mb-4 text-base font-bold text-slate-900">Catatan Darurat Medis</h3>
									<div class="grid gap-5 md:grid-cols-2">
										<label class="block">
											<span class="mb-1.5 block text-sm font-bold text-slate-700">
												Golongan Darah
											</span>
											<select
												bind:value={userProfile.bloodType}
												class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
											>
												<option value="A">A</option>
												<option value="B">B</option>
												<option value="AB">AB</option>
												<option value="O">O</option>
											</select>
										</label>
										<label class="block">
											<span class="mb-1.5 block text-sm font-bold text-slate-700">
												Alergi (Obat/Makanan)
											</span>
											<input
												bind:value={userProfile.allergies}
												class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
											/>
										</label>
									</div>
								</div>

								<div class="mt-8 flex justify-end">
									<button
										type="submit"
										class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90"
									>
										Simpan Perubahan
									</button>
								</div>
							</form>
						</section>

						<!-- Kanan: Preferensi Notifikasi & Keamanan -->
						<aside class="space-y-6">
							<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<h3 class="font-bold text-slate-900">Pengingat & Notifikasi</h3>
								<p class="mb-4 text-xs text-slate-500">
									Pilih media untuk menerima informasi jadwal & resep obat.
								</p>

								<div class="space-y-3">
									<label
										class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-slate-100"
									>
										<div>
											<p class="text-sm font-bold text-slate-800">Notifikasi WhatsApp</p>
											<p class="text-[11px] text-slate-500">Pengingat otomatis H-1 jadwal</p>
										</div>
										<input
											type="checkbox"
											bind:checked={notifSettings.whatsapp}
											class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
										/>
									</label>

									<label
										class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-slate-100"
									>
										<div>
											<p class="text-sm font-bold text-slate-800">Notifikasi Email</p>
											<p class="text-[11px] text-slate-500">Ringkasan hasil rekam medis</p>
										</div>
										<input
											type="checkbox"
											bind:checked={notifSettings.email}
											class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
										/>
									</label>
								</div>
							</div>

							<div class="rounded-[24px] bg-slate-900 p-6 text-white shadow-lg">
								<h3 class="font-bold">Keamanan & Privasi</h3>
								<p class="text-xs text-slate-400">Lindungi data kesehatan rahasia Anda</p>

								<div class="mt-5 space-y-3">
									<button
										class="w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold transition hover:bg-white/20"
									>
										Ubah Kata Sandi
									</button>
									<button
										class="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
									>
										Keluar dari Akun
									</button>
								</div>
							</div>
						</aside>
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>
