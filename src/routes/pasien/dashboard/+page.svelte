<script lang="ts">
    import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
    import { validateSession } from '$lib/utils/getProfile';
    import { api } from '$lib/api/api';
    import { authState } from '$lib/stores/auth.svelte';
    import DashboardSkeletonPasien from '$lib/components/skeleton/DashboardSkeletonPasien.svelte';
    import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
    let isLoading = $state(true);

	onMount(async () => {
        try {
            const profile = await validateSession();
            currentUser = profile;
            isLoading = false;
        } catch {
            // validateSession / api.ts will redirect to /login on auth failure
            isLoading = false;
        }
    });

    let currentUser = $state<{ role: string; name: string; id: string }>({
        role: 'pasien',
        name: '',
        id: ''
    });
    
    let activeMenu = $state('beranda');
    let isSidebarOpen = $state(false);        
	
	
	// --- STATE JANJI TEMU (PASIEN) ---
	let activeMeds = $state([
        { id: 1, name: 'Paracetamol 500mg', status: 'Siap Diambil di Apotek', isReady: true },
        { id: 2, name: 'Vitamin C 1000mg', status: 'Dikonsumsi (2 HARI LAGI)', isReady: false }
    ]);

    let careUpdates = $state([
        { id: 1, date: '28 Jul 2026', title: 'Hasil Cek Darah Keluar', desc: 'Semua indikator normal. Jaga pola makan.', doctor: 'dr. Nanda' }
    ]);
	let appointments = $state([
		{ 
			id: 1, 
			code: 'JK-2026-001',
			doctor: 'dr. Nanda Putri', 
			poli: 'Poliklinik Anak', 
			date: '2026-07-31', 
			time: '09:30', 
			status: 'Terjadwal',
			location: 'Gedung A, Lantai 2'
		},
		{ 
			id: 2, 
			code: 'JK-2026-003',
			doctor: 'dr. Arif Wijaya', 
			poli: 'Penyakit Dalam', 
			date: '2026-08-05', 
			time: '14:00', 
			status: 'Menunggu Konfirmasi',
			location: 'Gedung B, Lantai 1'
		}
	]);

	// State untuk Modal Form Buat/Ubah Janji
	let showApptModal = $state(false);
	let isEditingAppt = $state(false);
	let editApptId = $state<number | null>(null);
	let apptForm = $state({
		poli: '',
		doctor: '',
		doctor_id: '',
		date: '',
		time: ''
	});

	// State untuk fetch dokter berdasarkan poli + tanggal
	let availableDoctors = $state<any[]>([]);
	let isLoadingDoctors = $state(false);
	let doctorFetchError = $state('');

	// State untuk fetch jadwal praktek dokter di tanggal terpilih
	let doctorSchedule = $state<any[]>([]);
	let isLoadingSchedule = $state(false);
	let scheduleFetchError = $state('');
	let selectedDoctorName = $state('');

	// Daftar poliklinik yang tersedia
	const poliOptions = [
		'Penyakit Dalam',
		'Poliklinik Anak',
		'Gigi dan Mulut',
		'Kardiologi (Jantung)',
		'Mata',
		'THT (Telinga Hidung Tenggorokan)',
		'Kulit dan Kelamin',
		'Saraf (Neurologi)',
		'Bedah Umum',
		'Kebidanan dan Kandungan'
	];

	// Fetch dokter ketika poli DAN tanggal sudah dipilih
	async function fetchDoctorsByPoliAndDate() {
		if (!apptForm.poli || !apptForm.date) return;

		// Reset state terkait
		availableDoctors = [];
		doctorSchedule = [];
		apptForm.doctor = '';
		apptForm.doctor_id = '';
		apptForm.time = '';
		selectedDoctorName = '';
		isLoadingDoctors = true;
		doctorFetchError = '';

		try {
			const response = await api.get<any>(
				`/appointments/doctors?poli=${encodeURIComponent(apptForm.poli)}&date=${apptForm.date}`
			);
			availableDoctors = response.data || response || [];
		} catch (err: any) {
			doctorFetchError = err.message || 'Gagal memuat daftar dokter. Silakan coba lagi.';
		} finally {
			isLoadingDoctors = false;
		}
	}

	// Fetch jadwal praktek dokter di tanggal terpilih
	async function fetchDoctorSchedule(doctorId: string, doctorName: string) {
		apptForm.doctor = doctorName;
		apptForm.doctor_id = doctorId;
		apptForm.time = '';
		selectedDoctorName = doctorName;
		isLoadingSchedule = true;
		scheduleFetchError = '';
		doctorSchedule = [];

		try {
			const response = await api.get<any>(
				`/appointments/schedule?doctor_id=${doctorId}&date=${apptForm.date}`
			);
			doctorSchedule = response.data || response || [];
		} catch (err: any) {
			scheduleFetchError = err.message || 'Gagal memuat jadwal dokter.';
		} finally {
			isLoadingSchedule = false;
		}
	}

	// Handler ketika poli berubah
	function onPoliChange() {
		apptForm.doctor = '';
		apptForm.doctor_id = '';
		apptForm.time = '';
		availableDoctors = [];
		doctorSchedule = [];
		selectedDoctorName = '';
		if (apptForm.date) fetchDoctorsByPoliAndDate();
	}

	// Handler ketika tanggal berubah
	function onDateChange() {
		apptForm.doctor = '';
		apptForm.doctor_id = '';
		apptForm.time = '';
		availableDoctors = [];
		doctorSchedule = [];
		selectedDoctorName = '';
		if (apptForm.poli) fetchDoctorsByPoliAndDate();
	}

	// Pilih slot waktu dari jadwal
	function selectTimeSlot(time: string) {
		apptForm.time = time;
	}

	// Cek apakah form valid untuk submit
	let isApptFormValid = $derived(
		apptForm.poli !== '' && 
		apptForm.doctor !== '' && 
		apptForm.date !== '' && 
		apptForm.time !== ''
	);

	function openAddApptModal() {
		isEditingAppt = false;
		editApptId = null;
		apptForm = { poli: '', doctor: '', doctor_id: '', date: '', time: '' };
		availableDoctors = [];
		doctorSchedule = [];
		selectedDoctorName = '';
		doctorFetchError = '';
		scheduleFetchError = '';
		showApptModal = true;
	}

	function openEditApptModal(item: any) {
		isEditingAppt = true;
		editApptId = item.id;
		apptForm = { poli: item.poli, doctor: item.doctor, doctor_id: item.doctor_id || '', date: item.date, time: item.time };
		availableDoctors = [];
		doctorSchedule = [];
		selectedDoctorName = item.doctor;
		doctorFetchError = '';
		scheduleFetchError = '';
		showApptModal = true;
	}

	function cancelAppointment(id: number) {
		if (confirm('Yakin ingin membatalkan janji temu ini?')) {
			appointments = appointments.filter(a => a.id !== id);
		}
	}

	function saveAppointment(e: Event) {
		e.preventDefault();
		if (!isApptFormValid) return;
		
		if (isEditingAppt && editApptId !== null) {
			appointments = appointments.map(a => a.id === editApptId ? { ...a, ...apptForm } : a);
		} else {
			const newId = appointments.length > 0 ? Math.max(...appointments.map(a => a.id)) + 1 : 1;
			appointments = [...appointments, {
				id: newId,
				code: `JK-2026-00${newId}`,
				status: 'Menunggu Konfirmasi',
				location: 'Gedung Utama, Lantai 2',
				...apptForm
			}];
		}
		showApptModal = false;
	}

	// Mendapatkan tanggal minimum (hari ini)
	function getTodayDate(): string {
		const today = new Date();
		return today.toISOString().split('T')[0];
	}
	// --- STATE MENU RESEP OBAT (PASIEN) ---
	let activePrescriptions = $state([
		{
			id: 'RX-2026-007',
			doctor: 'dr. Nanda Putri',
			date: '30 Juli 2026',
			status: 'Siap Ambil', // 'Dalam Proses' atau 'Siap Ambil'
			isReady: true,
			medicines: [
				{ name: 'Paracetamol 500mg', rules: '3x1 Sehari (Sesudah makan)' },
				{ name: 'Amoxicillin 500mg', rules: '2x1 Sehari (Habiskan)' }
			]
		}
	]);

	let prescriptionHistory = $state([
		{
			id: 'RX-2026-002',
			doctor: 'dr. Arif Wijaya',
			date: '15 Juni 2026',
			status: 'Selesai',
			medicines: [
				{ name: 'Omeprazole 20mg', rules: '1x1 Sebelum makan' }
			]
		},
		{
			id: 'RX-2026-001',
			doctor: 'dr. Nanda Putri',
			date: '02 Mei 2026',
			status: 'Selesai',
			medicines: [
				{ name: 'Ibuprofen 400mg', rules: '3x1 Jika perlu' }
			]
		}
	]);
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

<Title
    title="Pasien | Dashboard"
/>

<div class="flex h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900">
    {#if isLoading}
        <SidebarSkeleton />
    {:else}
        <Sidebar role="pasien" activeMenu={activeMenu} isOpen={isSidebarOpen} onMenuSelect={(m) => activeMenu = m} onClose={() => isSidebarOpen = false} />
    {/if}

    <main class="flex-1 flex flex-col h-full overflow-hidden">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button onclick={() => isSidebarOpen = true} class="text-sky-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-7 w-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg></button>
            <div class="rounded-full bg-sky-50 border border-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">ID: {currentUser.id}</div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10">
            {#if isLoading}
                <DashboardSkeletonPasien />
            {:else}
            <!-- HEADER HERO PASIEN (LEMBUT & MENENANGKAN) -->
            <div class="mb-6 relative overflow-hidden rounded-[24px] bg-gradient-to-r from-sky-600 to-cyan-500 p-6 text-white shadow-lg sm:p-8">
                <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl"></div>
                <div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 class="text-3xl font-black sm:text-4xl">Selamat Datang, {currentUser.name}! 🌟</h1>
                        <p class="mt-2 text-sky-50">Semoga hari Anda sehat selalu. Berikut adalah ringkasan medis Anda.</p>
                    </div>
                    <div class="rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-md border border-white/20">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-sky-100">Nomor Rekam Medis</p>
                        <p class="mt-0.5 text-xl font-black tracking-wider text-white">{currentUser.id}</p>
                    </div>
                </div>
            </div>

            <!-- SMART ALERTS (Sistem Notifikasi Anti-Bingung) -->
            <div class="mb-8 space-y-3">
                {#if appointments.some(a => a.isUpcoming)}
                    <div class="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>
                            <div>
                                <p class="text-sm font-bold text-sky-900">Pengingat Jadwal Kunjungan</p>
                                <p class="text-xs font-medium text-sky-700">Anda memiliki jadwal dengan dokter <strong>Besok</strong>. Jangan sampai terlewat!</p>
                            </div>
                        </div>
                        <button onclick={() => activeMenu = 'janji'} class="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-700">Lihat Jadwal</button>
                    </div>
                {/if}

                {#if activeMeds.some(m => m.isReady)}
                    <div class="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>
                            <div>
                                <p class="text-sm font-bold text-emerald-900">Obat Anda Sudah Siap!</p>
                                <p class="text-xs font-medium text-emerald-700">Silakan menuju Loket Apotek untuk mengambil obat racikan Anda.</p>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

			<!-- ===================== -->
			<!-- MENU 1: BERANDA	   -->
			<!-- ===================== -->
            {#if activeMenu === 'beranda'}
                <div class="grid gap-6 lg:grid-cols-2">
                    <!-- KIRI: KARTU JADWAL -->
                    <section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                        <div class="mb-5 flex items-center justify-between">
                            <h2 class="text-lg font-bold text-slate-900">Jadwal Mendatang</h2>
                            <button onclick={() => activeMenu = 'janji'} class="text-sm font-bold text-sky-600">Lihat Semua &rarr;</button>
                        </div>
                        <div class="space-y-4">
                            {#each appointments as appt (appt.id)}
                                <div class={`rounded-xl border p-4 ${appt.isUpcoming ? 'border-sky-500 bg-sky-50/50 shadow-sm' : 'border-slate-100 bg-slate-50'}`}>
                                    <div class="flex items-center justify-between">
                                        <p class="font-black text-slate-900">{appt.poli}</p>
                                        {#if appt.isUpcoming} <span class="rounded bg-sky-100 px-2 py-1 text-[10px] font-black uppercase text-sky-700">Besok</span> {/if}
                                    </div>
                                    <p class="mt-1 text-sm font-medium text-slate-600">{appt.doctor}</p>
                                    <div class="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
                                        <span class="flex items-center gap-1">📅 {appt.date}</span>
                                        <span class="flex items-center gap-1">⏰ {appt.time} WIB</span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </section>

                    <!-- KANAN: STATUS OBAT & REKAM MEDIS -->
                    <aside class="space-y-6">
                        <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 class="mb-4 text-lg font-bold text-slate-900">Pengobatan Saat Ini</h2>
                            <div class="space-y-3">
                                {#each activeMeds as med (med.id)}
                                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                                        <p class="text-sm font-bold text-slate-900">{med.name}</p>
                                        <span class={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${med.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{med.status}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <div class="rounded-[24px] bg-slate-900 p-6 text-white shadow-lg">
                            <h2 class="mb-4 text-lg font-bold">Catatan Dokter (Terbaru)</h2>
                            {#each careUpdates as update (update.id)}
                                <div class="rounded-xl bg-white/10 p-4 border border-white/10">
                                    <div class="flex items-center justify-between mb-2">
                                        <p class="font-bold text-sky-300">{update.title}</p>
                                        <p class="text-[10px] text-slate-400">{update.date}</p>
                                    </div>
                                    <p class="text-sm text-slate-200 leading-relaxed">{update.desc}</p>
                                    <p class="mt-3 text-xs text-slate-400">Pemeriksa: {update.doctor}</p>
                                </div>
                            {/each}
                        </div>
                    </aside>
                </div>			
			<!-- =========================== -->
			<!-- MENU 2: JANJI TEMU (PASIEN) -->
			<!-- =========================== -->	
			{:else if activeMenu == 'janji'}
				<div class="space-y-6">
					
					<!-- Banner Atas / Aksi Buat Janji -->
					<div class="flex flex-col gap-4 rounded-[24px] border border-sky-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
						<div>
							<h2 class="text-xl font-bold text-slate-900">Kelola Janji Temu Dokter</h2>
							<p class="mt-1 text-sm text-slate-500">Buat jadwal konsultasi baru atau ubah jadwal yang sudah ada.</p>
						</div>
						<button onclick={openAddApptModal} class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90">
							<span>➕</span> Buat Janji Temu Baru
						</button>
					</div>

					<!-- Daftar Kartu Janji Temu -->
					<div class="grid gap-5 md:grid-cols-2">
						{#each appointments as item (item.id)}
							<div class="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300">
								<div>
									<!-- Header Kartu -->
									<div class="flex items-center justify-between border-b border-slate-100 pb-3">
										<span class="rounded-lg bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{item.poli}</span>
										<span class={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${item.status === 'Terjadwal' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
											{item.status}
										</span>
									</div>

									<!-- Info Dokter & Waktu -->
									<div class="mt-4 space-y-2">
										<p class="text-xl font-bold text-slate-900">{item.doctor}</p>
										<p class="flex items-center gap-2 text-sm font-semibold text-slate-600">
											<span>📅</span> {item.date} &nbsp;|&nbsp; <span>⏰</span> {item.time} WIB
										</p>
										<p class="flex items-center gap-2 text-xs font-medium text-slate-400">
											<span>📍</span> {item.location}
										</p>
									</div>
								</div>

								<!-- Tombol Aksi CRUD -->
								<div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
									<span class="text-xs font-bold text-slate-400">Kode: {item.code}</span>
									<div class="flex gap-2">
										<button onclick={() => openEditApptModal(item)} class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Ubah Jadwal</button>
										<button onclick={() => cancelAppointment(item.id)} class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100">Batalkan</button>
									</div>
								</div>
							</div>
						{:else}
							<div class="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
								Belum ada janji temu aktif. Klik tombol di atas untuk membuat jadwal baru.
							</div>
						{/each}
					</div>
				</div>

				<!-- MODAL FORM CRUD JANJI TEMU PASIEN (REVISED FLOW) -->
				{#if showApptModal}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onkeydown={(e) => e.key === 'Escape' && (showApptModal = false)}>
						<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white p-7 shadow-2xl sm:p-8">
							
							<!-- Header Modal -->
							<div class="mb-6 border-b border-slate-100 pb-5">
								<h2 class="text-xl font-bold text-slate-900">{isEditingAppt ? 'Ubah Jadwal Konsultasi' : 'Buat Janji Temu Baru'}</h2>
								<p class="mt-1 text-sm text-slate-500">Pilih poliklinik dan tanggal terlebih dahulu untuk melihat dokter yang tersedia.</p>
							</div>
							
							<form onsubmit={saveAppointment} class="space-y-6">
								
								<!-- STEP 1: Pilih Poliklinik & Tanggal -->
								<div class="rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
									<div class="mb-4 flex items-center gap-2">
										<div class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white">1</div>
										<h3 class="text-sm font-bold text-slate-800">Pilih Poliklinik & Tanggal Kunjungan</h3>
									</div>
									
									<div class="grid gap-4 sm:grid-cols-2">
										<label class="block">
											<span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Departemen / Poliklinik</span>
											<select 
												bind:value={apptForm.poli} 
												onchange={onPoliChange}
												class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											>
												<option value="">— Pilih Poliklinik —</option>
												{#each poliOptions as poli}
													<option value={poli}>{poli}</option>
												{/each}
											</select>
										</label>

										<label class="block">
											<span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal Kunjungan</span>
											<input 
												type="date" 
												bind:value={apptForm.date} 
												onchange={onDateChange}
												min={getTodayDate()}
												class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" 
											/>
										</label>
									</div>

									{#if !apptForm.poli || !apptForm.date}
										<p class="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600">
											<span>⚠️</span> Lengkapi poliklinik dan tanggal untuk melihat dokter yang tersedia.
										</p>
									{/if}
								</div>

								<!-- STEP 2: Pilih Dokter (muncul setelah poli + tanggal dipilih) -->
								{#if apptForm.poli && apptForm.date}
									<div class="rounded-2xl border border-slate-200 bg-white p-5">
										<div class="mb-4 flex items-center gap-2">
											<div class="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white">2</div>
											<h3 class="text-sm font-bold text-slate-800">Pilih Dokter yang Praktek</h3>
										</div>

										{#if isLoadingDoctors}
											<!-- Loading State -->
											<div class="flex flex-col items-center justify-center py-8">
												<div class="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"></div>
												<p class="text-sm font-medium text-slate-500">Memuat daftar dokter...</p>
											</div>
										{:else if doctorFetchError}
											<!-- Error State -->
											<div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
												<p class="text-sm font-bold text-rose-600">❌ {doctorFetchError}</p>
												<button 
													type="button" 
													onclick={fetchDoctorsByPoliAndDate} 
													class="mt-2 rounded-lg bg-rose-100 px-4 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200"
												>
													Coba Lagi
												</button>
											</div>
										{:else if availableDoctors.length === 0}
											<!-- Empty State -->
											<div class="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
												<p class="text-2xl">🏥</p>
												<p class="mt-2 text-sm font-bold text-slate-500">Tidak ada dokter yang praktek</p>
												<p class="text-xs text-slate-400">Coba ubah poliklinik atau pilih tanggal lain.</p>
											</div>
										{:else}
											<!-- Daftar Kartu Dokter -->
											<div class="grid gap-3 sm:grid-cols-2">
												{#each availableDoctors as doc}
													<button 
														type="button"
														onclick={() => fetchDoctorSchedule(doc.id, doc.name)}
														class="group flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all {apptForm.doctor_id === doc.id ? 'border-sky-500 bg-sky-50 shadow-md shadow-sky-100' : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'}"
													>
														<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {apptForm.doctor_id === doc.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-600'}">
															<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
															</svg>
														</div>
														<div class="flex-1 min-w-0">
															<p class="text-sm font-bold text-slate-900 truncate">{doc.name}</p>
															{#if doc.specialization}
																<p class="text-xs font-medium text-sky-600">{doc.specialization}</p>
															{/if}
															{#if doc.practice_hours}
																<p class="mt-1 text-[11px] text-slate-400">🕐 {doc.practice_hours}</p>
															{/if}
															{#if apptForm.doctor_id === doc.id}
																<span class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
																	✓ Dipilih
																</span>
															{/if}
														</div>
													</button>
												{/each}
											</div>
										{/if}
									</div>
								{/if}

								<!-- STEP 3: Lihat Jadwal & Pilih Waktu (muncul setelah dokter dipilih) -->
								{#if apptForm.doctor}
									<div class="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5">
										<div class="mb-4 flex items-center gap-2">
											<div class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">3</div>
											<h3 class="text-sm font-bold text-slate-800">Jadwal Praktek & Pilih Jam</h3>
										</div>

										<div class="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
											<p class="text-xs font-medium text-sky-700">
												📋 Jadwal <strong>{selectedDoctorName}</strong> pada tanggal <strong>{apptForm.date}</strong>
											</p>
										</div>

										{#if isLoadingSchedule}
											<div class="flex items-center justify-center gap-2 py-6">
												<div class="h-5 w-5 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600"></div>
												<p class="text-sm font-medium text-slate-500">Memuat jadwal...</p>
											</div>
										{:else if scheduleFetchError}
											<div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
												<p class="text-sm font-bold text-rose-600">❌ {scheduleFetchError}</p>
											</div>
										{:else if doctorSchedule.length > 0}
											<!-- Grid Slot Waktu -->
											<div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
												{#each doctorSchedule as slot}
													<button
														type="button"
														onclick={() => selectTimeSlot(slot.time)}
														disabled={slot.is_booked}
														class="rounded-xl border-2 px-3 py-2.5 text-center text-sm font-bold transition-all
															{slot.is_booked 
																? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 line-through' 
																: apptForm.time === slot.time 
																	? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100' 
																	: 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}"
													>
														{slot.time}
														{#if slot.is_booked}
															<span class="block text-[9px] font-medium text-slate-400 no-underline" style="text-decoration: none;">Terisi</span>
														{:else if slot.patient_count !== undefined}
															<span class="block text-[9px] font-medium text-emerald-500">{slot.patient_count} pasien</span>
														{/if}
													</button>
												{/each}
											</div>

											<!-- Legenda -->
											<div class="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
												<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded border border-slate-200 bg-white"></span> Tersedia</span>
												<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded border border-emerald-500 bg-emerald-50"></span> Dipilih</span>
												<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded border border-slate-200 bg-slate-100"></span> Penuh</span>
											</div>
										{:else}
											<!-- Fallback: input manual jika API jadwal belum tersedia -->
											<div class="space-y-3">
												<p class="text-xs text-slate-500">Data slot jadwal belum tersedia. Silakan pilih jam secara manual:</p>
												<label class="block">
													<span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Estimasi Jam Kunjungan</span>
													<input 
														type="time" 
														bind:value={apptForm.time} 
														class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" 
													/>
												</label>
											</div>
										{/if}
									</div>
								{/if}

								<!-- SUMMARY / KONFIRMASI (muncul jika semua sudah dipilih) -->
								{#if isApptFormValid}
									<div class="rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 p-5">
										<div class="mb-3 flex items-center gap-2">
											<span class="text-lg">✅</span>
											<h3 class="text-sm font-bold text-emerald-800">Ringkasan Janji Temu</h3>
										</div>
										<div class="grid gap-2 text-sm sm:grid-cols-2">
											<div class="rounded-lg bg-white/80 p-3">
												<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Poliklinik</p>
												<p class="font-bold text-slate-900">{apptForm.poli}</p>
											</div>
											<div class="rounded-lg bg-white/80 p-3">
												<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dokter</p>
												<p class="font-bold text-slate-900">{apptForm.doctor}</p>
											</div>
											<div class="rounded-lg bg-white/80 p-3">
												<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal</p>
												<p class="font-bold text-slate-900">📅 {apptForm.date}</p>
											</div>
											<div class="rounded-lg bg-white/80 p-3">
												<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jam</p>
												<p class="font-bold text-slate-900">⏰ {apptForm.time} WIB</p>
											</div>
										</div>
									</div>
								{/if}

								<!-- Tombol Aksi -->
								<div class="flex justify-end gap-3 border-t border-slate-100 pt-5">
									<button type="button" onclick={() => showApptModal = false} class="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100">Batal</button>
									<button 
										type="submit" 
										disabled={!isApptFormValid}
										class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
									>
										{isEditingAppt ? 'Simpan Perubahan' : 'Konfirmasi Janji Temu'}
									</button>
								</div>
							</form>
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
						<p class="mt-1 text-sm text-slate-500">Pantau status peracikan obat dari dokter dan lihat riwayat tebus resep Anda.</p>
					</div>

					<!-- Bagian 1: Resep Aktif (Sedang Berjalan) -->
					<section class="space-y-4">
						<h3 class="text-lg font-bold text-slate-800">Status Resep Saat Ini</h3>
						
						{#each activePrescriptions as rx (rx.id)}
							<div class={`overflow-hidden rounded-[24px] border transition-all ${rx.isReady ? 'border-emerald-300 bg-emerald-50/40 shadow-md' : 'border-sky-200 bg-white shadow-sm'}`}>
								<div class="p-6 sm:p-7">
									<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
										<div>
											<div class="flex items-center gap-2 mb-1">
												<span class={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${rx.isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
													{rx.status}
												</span>
												<span class="text-xs font-bold text-slate-400">ID: {rx.id}</span>
											</div>
											<h4 class="text-lg font-bold text-slate-900">Pemeriksaan oleh {rx.doctor}</h4>
											<p class="text-xs font-medium text-slate-500">Diresepkan pada {rx.date}</p>
										</div>

										{#if rx.isReady}
											<div class="rounded-2xl bg-emerald-600 px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm">
												🎫 Silakan Ambil di Loket Apotek
											</div>
										{:else}
											<div class="rounded-2xl bg-sky-100 px-4 py-2.5 text-center text-xs font-bold text-sky-700">
												⏳ Sedang Diracik Apoteker
											</div>
										{/if}
									</div>

									<!-- Daftar Detail Obat -->
									<div class="mt-4">
										<p class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Daftar Obat & Aturan Pakai</p>
										<div class="grid gap-3 sm:grid-cols-2">
											{#each rx.medicines as med (med)}
												<div class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
													<p class="font-bold text-slate-900">{med.name}</p>
													<p class="mt-1 text-xs font-semibold text-sky-700">💊 {med.rules}</p>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						{:else}
							<div class="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-slate-400">
								Tidak ada resep aktif saat ini.
							</div>
						{/each}
					</section>

					<!-- Bagian 2: Riwayat Pengobatan Terdahulu -->
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
						<h3 class="mb-5 text-lg font-bold text-slate-900">Riwayat Pengobatan Terdahulu</h3>

						<div class="space-y-4">
							{#each prescriptionHistory as history (history.id)}
								<div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<div class="flex items-center gap-2 mb-1">
											<span class="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">{history.status}</span>
											<span class="text-xs font-semibold text-slate-400">{history.date}</span>
										</div>
										<p class="font-bold text-slate-900">{history.doctor}</p>
										<p class="mt-2 text-xs font-medium text-slate-600">
											Obat: <span class="font-semibold text-slate-800">{history.medicines.map(m => m.name).join(', ')}</span>
										</p>
									</div>
									<span class="text-xs font-bold text-slate-400">ID: {history.id}</span>
								</div>
							{/each}
						</div>
					</section>
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
							<p class="text-sm text-slate-500">Perbarui data diri dan riwayat medis ringkas Anda.</p>
						</div>
						
						<form onsubmit={saveProfileChanges} class="space-y-5">
							<div class="grid gap-5 md:grid-cols-2">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Nama Lengkap</span>
									<input bind:value={userProfile.name} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Nomor Rekam Medis (ID)</span>
									<input value={currentUser.id} disabled class="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400 outline-none" />
								</label>
							</div>

							<div class="grid gap-5 md:grid-cols-2">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Alamat Email</span>
									<input type="email" bind:value={userProfile.email} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Nomor Telepon / WhatsApp</span>
									<input type="tel" bind:value={userProfile.phone} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>
							</div>

							<label class="block">
								<span class="mb-1.5 block text-sm font-bold text-slate-700">Alamat Tempat Tinggal</span>
								<textarea bind:value={userProfile.address} rows="2" class="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"></textarea>
							</label>

							<div class="my-6 border-t border-slate-100 pt-4">
								<h3 class="mb-4 text-base font-bold text-slate-900">Catatan Darurat Medis</h3>
								<div class="grid gap-5 md:grid-cols-2">
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Golongan Darah</span>
										<select bind:value={userProfile.bloodType} class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100">
											<option value="A">A</option>
											<option value="B">B</option>
											<option value="AB">AB</option>
											<option value="O">O</option>
										</select>
									</label>
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Alergi (Obat/Makanan)</span>
										<input bind:value={userProfile.allergies} class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
									</label>
								</div>
							</div>

							<div class="mt-8 flex justify-end">
								<button type="submit" class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90">
									Simpan Perubahan
								</button>
							</div>
						</form>
					</section>

					<!-- Kanan: Preferensi Notifikasi & Keamanan -->
					<aside class="space-y-6">
						
						<!-- Preferensi Notifikasi -->
						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							<h3 class="font-bold text-slate-900">Pengingat & Notifikasi</h3>
							<p class="mb-4 text-xs text-slate-500">Pilih media untuk menerima informasi jadwal & resep obat.</p>
							
							<div class="space-y-3">
								<label class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-slate-100">
									<div>
										<p class="text-sm font-bold text-slate-800">Notifikasi WhatsApp</p>
										<p class="text-[11px] text-slate-500">Pengingat otomatis H-1 jadwal</p>
									</div>
									<input type="checkbox" bind:checked={notifSettings.whatsapp} class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
								</label>

								<label class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 transition hover:bg-slate-100">
									<div>
										<p class="text-sm font-bold text-slate-800">Notifikasi Email</p>
										<p class="text-[11px] text-slate-500">Ringkasan hasil rekam medis</p>
									</div>
									<input type="checkbox" bind:checked={notifSettings.email} class="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
								</label>
							</div>
						</div>

						<!-- Keamanan Akun -->
						<div class="rounded-[24px] bg-slate-900 p-6 text-white shadow-lg">
							<h3 class="font-bold">Keamanan & Privasi</h3>
							<p class="text-xs text-slate-400">Lindungi data kesehatan rahasia Anda</p>
							
							<div class="mt-5 space-y-3">
								<button class="w-full rounded-xl border border-white/20 bg-white/10 py-3 text-sm font-bold transition hover:bg-white/20">
									Ubah Kata Sandi
								</button>
								<button class="w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white transition hover:bg-rose-700">
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