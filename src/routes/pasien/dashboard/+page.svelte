<script lang="ts">
    import { browser } from '$app/environment';
    import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';

    function readCookie(name: string) {
        if (!browser || typeof document === 'undefined') return '';
        const cookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.substring(name.length + 1)) : '';
    }

    let currentUser = $state({ 
        role: 'pasien', 
        name: readCookie('medsync_name') || 'Ayu Putri', 
        id: readCookie('medsync_user_id') || 'BP-2054' 
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
		poli: 'Penyakit Dalam',
		doctor: '',
		date: '',
		time: ''
	});

	function openAddApptModal() {
		isEditingAppt = false;
		editApptId = null;
		apptForm = { poli: 'Penyakit Dalam', doctor: '', date: '', time: '' };
		showApptModal = true;
	}

	function openEditApptModal(item: any) {
		isEditingAppt = true;
		editApptId = item.id;
		apptForm = { poli: item.poli, doctor: item.doctor, date: item.date, time: item.time };
		showApptModal = true;
	}

	function cancelAppointment(id: number) {
		if (confirm('Yakin ingin membatalkan janji temu ini?')) {
			appointments = appointments.filter(a => a.id !== id);
		}
	}

	function saveAppointment(e: Event) {
		e.preventDefault();
		if (isEditingAppt && editApptId !== null) {
			appointments = appointments.map(a => a.id === editApptId ? { ...a, ...apptForm } : a);
		} else {
			const newId = appointments.length > 0 ? Math.max(...appointments.map(a => a.id)) + 1 : 1;
			appointments = [...appointments, {
				id: newId,
				code: `JK-2026-00${newId}`,
				status: 'Terjadwal',
				location: 'Gedung Utama, Lantai 2',
				...apptForm
			}];
		}
		showApptModal = false;
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
    <Sidebar role="pasien" activeMenu={activeMenu} isOpen={isSidebarOpen} onMenuSelect={(m) => activeMenu = m} onClose={() => isSidebarOpen = false} />

    <main class="flex-1 flex flex-col h-full overflow-hidden">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button onclick={() => isSidebarOpen = true} class="text-sky-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-7 w-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg></button>
            <div class="rounded-full bg-sky-50 border border-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">ID: {currentUser.id}</div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10">
            
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

				<!-- MODAL FORM CRUD JANJI TEMU PASIEN -->
				{#if showApptModal}
					<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
						<div class="w-full max-w-md rounded-[28px] bg-white p-7 shadow-2xl">
							<h2 class="mb-2 text-xl font-bold text-slate-900">{isEditingAppt ? 'Ubah Jadwal Konsultasi' : 'Buat Janji Temu Baru'}</h2>
							<p class="mb-5 text-xs text-slate-500">Pilih poliklinik dan dokter yang ingin Anda tuju.</p>
							
							<form onsubmit={saveAppointment} class="space-y-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Pilih Poliklinik</span>
									<select bind:value={apptForm.poli} class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100">
										<option value="Penyakit Dalam">Penyakit Dalam</option>
										<option value="Poliklinik Anak">Poliklinik Anak</option>
										<option value="Gigi dan Mulut">Gigi dan Mulut</option>
										<option value="Kardiologi (Jantung)">Kardiologi (Jantung)</option>
									</select>
								</label>
								
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Nama Dokter Spesialis</span>
									<input type="text" bind:value={apptForm.doctor} required placeholder="Contoh: dr. Nanda Putri, Sp.A" class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>

								<div class="grid grid-cols-2 gap-4">
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Tanggal Kunjungan</span>
										<input type="date" bind:value={apptForm.date} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
									</label>
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Estimasi Jam</span>
										<input type="time" bind:value={apptForm.time} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
									</label>
								</div>

								<div class="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
									<button type="button" onclick={() => showApptModal = false} class="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
									<button type="submit" class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90">
										{isEditingAppt ? 'Simpan Perubahan' : 'Konfirmasi Janji'}
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
        </div>
    </main>
</div>