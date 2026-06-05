<script lang="ts">
    import { browser } from '$app/environment';
    import Sidebar from '$lib/components/Sidebar.svelte';
    import Title from '$lib/components/Title.svelte';

    type DashboardUser = { role: string; name: string; id: string; };

    function readCookie(name: string) {
        if (!browser || typeof document === 'undefined') return '';
        const cookie = document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
        if (!cookie) return '';
        return decodeURIComponent(cookie.substring(name.length + 1));
    }

    function getSessionFromCookie() {
        return { 
            role: readCookie('medsync_role') || 'dokter', 
            name: readCookie('medsync_name') || 'Dokter', 
            id: readCookie('medsync_user_id') || 'DOC-001' 
        };
    }

    let currentUser = $state<DashboardUser>({ role: 'dokter', name: '', id: '' });
    if (browser) currentUser = getSessionFromCookie();
    
    let activeMenu = $state('beranda');
    let isSidebarOpen = $state(false);

    // --- DATA DUMMY ANTREAN PASIEN ---
    let patientQueue = $state([
        { id: 'RM-099', name: 'Ayu Putri', age: 24, time: '08:30', status: 'Sedang Diperiksa', complaint: 'Demam tinggi 3 hari', isUrgent: false },
        { id: 'RM-102', name: 'Bapak Sudirman', age: 58, time: '09:00', status: 'Menunggu', complaint: 'Nyeri dada, sesak napas', isUrgent: true },
        { id: 'RM-105', name: 'Siti Aminah', age: 32, time: '09:30', status: 'Menunggu', complaint: 'Kontrol rutin kehamilan', isUrgent: false }
    ]);

    let activePatient = $derived(patientQueue[0]); // Simulasi pasien pertama adalah yang sedang diperiksa

    // --- STATE FORM RESEP (Otomatis terisi dari pasien aktif) ---
    let diagnosis = $state('Suspect Tipes (Observasi)');
    let searchQuery = $state('');
    let selectedMedicines = $state<Array<{ name: string; usage: string }>>([]);
    let receiptVisible = $state(false);
    let printMode = $state(false);

    const medicineCatalog = [
        { name: 'Paracetamol 500mg', stock: 42, category: 'Analgesik', availability: 'Tersedia', alternative: 'Ibuprofen', notes: 'Penurun demam' },
        { name: 'Amoxicillin 500mg', stock: 18, category: 'Antibiotik', availability: 'Tersedia', alternative: 'Cefixime', notes: 'Infeksi ringan-sedang' },
        { name: 'Omeprazole 20mg', stock: 7, category: 'Pencernaan', availability: 'Kritis', alternative: 'Pantoprazole', notes: 'Asam lambung' },
        { name: 'Isosorbide Dinitrate 5mg', stock: 15, category: 'Jantung', availability: 'Tersedia', alternative: 'Nitroglycerin', notes: 'Nyeri dada angina' }
    ];

    let filteredMedicines = $derived(
        medicineCatalog.filter((med) => {
            const query = searchQuery.toLowerCase();
            return med.name.toLowerCase().includes(query) || med.category.toLowerCase().includes(query) || med.notes.toLowerCase().includes(query);
        })
    );

    function toggleMedicine(name: string) {
        const existing = selectedMedicines.find((item) => item.name === name);
        if (existing) selectedMedicines = selectedMedicines.filter((item) => item.name !== name);
        else selectedMedicines = [...selectedMedicines, { name, usage: '' }];
    }

    function updateMedicineUsage(name: string, usage: string) {
        selectedMedicines = selectedMedicines.map((item) => item.name === name ? { ...item, usage } : item );
    }

    function printReceipt() {
        receiptVisible = true;
        setTimeout(() => window.print(), 150);
    }


	// --- DUMMY DATA: MENU JADWAL PRAKTIK (DOKTER) ---
	let doctorAppointments = $state([
		{ id: 'AP-001', patientName: 'Bapak Sudirman', date: 'Hari Ini', time: '09:00 WIB', status: 'Menunggu', type: 'Konsultasi Rutin' },
		{ id: 'AP-002', patientName: 'Siti Aminah', date: 'Hari Ini', time: '09:30 WIB', status: 'Menunggu', type: 'Kontrol Kehamilan' },
		{ id: 'AP-003', patientName: 'Ayu Putri', date: 'Besok, 31 Jul', time: '10:00 WIB', status: 'Terjadwal', type: 'Pemeriksaan Lab' },
		{ id: 'AP-004', patientName: 'Budi Santoso', date: 'Besok, 31 Jul', time: '11:00 WIB', status: 'Dibatalkan', type: 'Tindakan Ringan' }
	]);
	// State untuk form atur jadwal (CRUD Sederhana)
	let scheduleForm = $state({
		date: '',
		startTime: '',
		endTime: '',
		quota: 10
	});
	function handleSaveSchedule(e: Event) {
		e.preventDefault();
		alert('Jadwal praktik berhasil diperbarui!');
		// Logika simpan ke database nanti ada di sini
	}
	function cancelAppointment(id: string) {
		if(confirm('Anda yakin ingin membatalkan janji temu ini? Pasien akan menerima notifikasi.')) {
			doctorAppointments = doctorAppointments.map(app => app.id === id ? { ...app, status: 'Dibatalkan' } : app);
		}
	}
    // --- STATE MENU DAFTAR PASIEN (DOKTER) ---
    let patientSearchQuery = $state('');
    let patientList = $state([
        { 
            id: 'RM-099', 
            name: 'Ayu Putri', 
            age: 24, 
            gender: 'Perempuan', 
            lastVisit: '30 Juli 2026', 
            diagnosis: 'Demam dan batuk ringan', 
            status: 'Rawat Jalan',
            phone: '0812-3456-7890'
        },
        { 
            id: 'RM-102', 
            name: 'Bapak Sudirman', 
            age: 58, 
            gender: 'Laki-laki', 
            lastVisit: '28 Juli 2026', 
            diagnosis: 'Hipertensi Stage 2', 
            status: 'Kontrol Rutin',
            phone: '0813-9876-5432'
        },
        { 
            id: 'RM-105', 
            name: 'Siti Aminah', 
            age: 32, 
            gender: 'Perempuan', 
            lastVisit: '15 Juni 2026', 
            diagnosis: 'Observasi Kehamilan Trimester 2', 
            status: 'Selesai',
            phone: '0821-1122-3344'
        }
    ]);

    let filteredPatients = $derived(
        patientList.filter(p => 
            p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) || 
            p.id.toLowerCase().includes(patientSearchQuery.toLowerCase())
        )
    );
</script>

<style>
    /* CSS Print Struk Dipertahankan */
    .receipt-print-card { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #0f172a; }
    .receipt-print-divider { border-top: 1px dashed #cbd5e1; margin: 8px 0; }
    .receipt-print-line-item { border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; margin-bottom: 4px; }
    @media print {
        @page { size: 80mm auto; margin: 0; }
        :global(body) { background: #ffffff !important; margin: 0; padding: 0; width: 80mm; }
        :global(body *) { visibility: hidden; }
        .receipt-print-shell, .receipt-print-shell * { visibility: visible; }
        .receipt-print-shell { position: absolute; left: 0; top: 0; width: 80mm; margin: 0; padding: 0; background: #ffffff; border: none; box-shadow: none; }
        .receipt-print-card { width: 80mm; margin: 0 auto; border: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>

<Title
    title="Dokter | Dashboard"
/>

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
    <Sidebar role="dokter" activeMenu={activeMenu} isOpen={isSidebarOpen} onMenuSelect={(m) => activeMenu = m} onClose={() => isSidebarOpen = false} />

    <main class="flex-1 flex flex-col h-full overflow-hidden">
        <!-- Header Mobile -->
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button onclick={() => isSidebarOpen = true} class="text-sky-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-7 w-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
            </button>
            <div class="rounded-full bg-sky-50 border border-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700">ID: {currentUser.id}</div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10">
            <!-- HIGHLIGHT BANNER: PANEL DOKTER -->
			<div class="mb-8 relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 p-6 text-white shadow-xl sm:p-8">
				<!-- Efek Cahaya Latar -->
				<div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl"></div>
				<div class="absolute bottom-0 right-5 opacity-10">
					<!-- Ikon Stetoskop Watermark -->
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-32 w-32">
						<path fill-rule="evenodd" d="M11.966 1.488a.75.75 0 01.956.444l.808 2.022c.241.603.266 1.258.117 1.868l-.888 3.555a.75.75 0 01-.84.545l-4.548-.758a.75.75 0 01-.58-.937l1.092-4.368c.137-.549.46-1.01.91-1.309l2.53-1.686a.75.75 0 01.443-.376zM4.774 9.176a.75.75 0 00-1.042.278A9.97 9.97 0 003 14.5a10.024 10.024 0 004.225 8.163.75.75 0 00.866-1.242 8.524 8.524 0 01-3.591-6.921c0-1.57.426-3.045 1.168-4.282a.75.75 0 00-.275-1.042zM21 14.5a.75.75 0 01-1.5 0c0-1.57-.426-3.045-1.168-4.282a.75.75 0 00-1.317.764A9.97 9.97 0 0119.5 14.5c0 2.454-.882 4.702-2.345 6.448a.75.75 0 001.129 1.004A11.464 11.464 0 0021 14.5z" clip-rule="evenodd" />
						<path d="M12 14.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
					</svg>
				</div>
				
				<div class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
					<div>
						<!-- Indikator Status Nyala -->
						<div class="mb-3 flex items-center gap-2">
							<span class="relative flex h-2.5 w-2.5">
								<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
							</span>
							<p class="text-[11px] font-bold uppercase tracking-widest text-sky-200">Mode Praktik Aktif</p>
						</div>
						
						<h1 class="text-3xl font-black sm:text-4xl">Halo, dr. {currentUser.name}! 🩺</h1>
						<p class="mt-2 text-sm text-slate-300 sm:text-base">
							Selamat bertugas di RS Medika Sehat. Terdapat <strong class="text-white">{patientQueue.length - 1} pasien</strong> menunggu antrean Anda saat ini.
						</p>
					</div>
					
					<!-- Info ID Dokter yang menonjol -->
					<div class="flex flex-col items-start sm:items-end">
						<div class="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-md shadow-inner">
							<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Identitas Dokter</p>
							<p class="mt-0.5 text-lg font-black tracking-wider text-white">{currentUser.id}</p>
						</div>
					</div>
				</div>
			</div>
            <!-- ===================== -->
			<!-- MENU 1: BERANDA	   -->
			<!-- ===================== -->
            {#if activeMenu === 'beranda'}                
                <!-- 1. STATISTIK CEPAT (Dengan Warna Performa) -->
                <section class="mb-6 grid gap-4 sm:grid-cols-3">
                    <div class="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg></div>
                            <p class="text-sm font-bold text-slate-600">Total Pasien</p>
                        </div>
                        <p class="mt-3 text-3xl font-black text-slate-800">24 <span class="text-sm font-medium text-slate-400">/ hari ini</span></p>
                    </div>
                    <div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></div>
                            <p class="text-sm font-bold text-slate-600">Selesai Diperiksa</p>
                        </div>
                        <p class="mt-3 text-3xl font-black text-emerald-600">18</p>
                    </div>
                    <div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg></div>
                            <p class="text-sm font-bold text-slate-600">Menunggu Antrean</p>
                        </div>
                        <p class="mt-3 text-3xl font-black text-amber-600">6</p>
                    </div>
                </section>

                <!-- 2. HIGHLIGHT MODULE: PASIEN SAAT INI (Sangat Eye-catching) -->
                <section class="mb-6 overflow-hidden rounded-[24px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-xl lg:p-8">
                    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div class="flex items-center gap-3 mb-3">
                                <span class="relative flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
                                <p class="text-xs font-bold uppercase tracking-widest text-emerald-400">Sedang Diperiksa</p>
                            </div>
                            <h2 class="text-3xl font-black">{activePatient.name} <span class="text-xl font-medium text-slate-400">({activePatient.age} thn)</span></h2>
                            <p class="mt-2 text-lg text-slate-300">No. RM: <span class="font-bold text-white">{activePatient.id}</span></p>
                        </div>
                        
                        <div class="rounded-2xl bg-white/10 p-4 backdrop-blur-md md:w-1/3 border border-white/10">
                            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Keluhan Utama</p>
                            <p class="mt-1 text-lg font-semibold text-white">{activePatient.complaint}</p>
                            <button class="mt-4 w-full rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-200">Buka Riwayat Medis</button>
                        </div>
                    </div>
                </section>

                <div class="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                    
                    <!-- KIRI: FORM RESEP (Fokus Eksekusi) -->
                    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 class="text-xl font-bold text-slate-900">Resep & Tindakan</h2>
                                <p class="text-sm text-slate-500">Resepkan obat untuk {activePatient.name}</p>
                            </div>
                        </div>

                        <form onsubmit={(e) => { e.preventDefault(); receiptVisible = true; }} class="space-y-5">
                            <label class="block">
                                <span class="mb-2 block text-sm font-bold text-slate-700">Hasil Diagnosa</span>
                                <input bind:value={diagnosis} class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
                            </label>

                            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                <label class="block">
                                    <span class="mb-2 block text-sm font-bold text-slate-700">Cari Obat (Katalog Apotek)</span>
                                    <input bind:value={searchQuery} class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Ketik nama obat, keluhan, atau kategori..." />
                                </label>

                                <div class="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-2">
                                    {#each filteredMedicines as medicine (medicine.category)}
                                        <div class={`flex flex-col justify-between rounded-xl border p-3 sm:flex-row sm:items-center ${selectedMedicines.some(m => m.name === medicine.name) ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <p class="font-bold text-slate-900">{medicine.name}</p>
                                                    {#if medicine.availability === 'Kritis'}
                                                        <span class="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">Stok Tipis</span>
                                                    {/if}
                                                </div>
                                                <p class="text-xs font-medium text-slate-500">{medicine.category} • Alternatif: {medicine.alternative}</p>
                                            </div>
                                            <button type="button" class={`mt-2 shrink-0 rounded-lg border px-4 py-1.5 text-xs font-bold sm:mt-0 ${selectedMedicines.some(m => m.name === medicine.name) ? 'border-red-200 bg-white text-red-600 hover:bg-red-50' : 'border-slate-300 bg-slate-900 text-white hover:bg-slate-700'}`} onclick={() => toggleMedicine(medicine.name)}>
                                                {selectedMedicines.some(m => m.name === medicine.name) ? 'Batalkan' : '+ Resepkan'}
                                            </button>
                                        </div>
                                        {#if selectedMedicines.some(m => m.name === medicine.name)}
                                            <div class="ml-4 mt-1 border-l-2 border-sky-200 pl-3">
                                                <input class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-500" placeholder="Aturan Pakai (misal: 3x1 setelah makan)" value={selectedMedicines.find(m => m.name === medicine.name)?.usage ?? ''} oninput={(e) => updateMedicineUsage(medicine.name, e.currentTarget.value)} />
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            </div>

                            <button type="submit" class="w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90">
                                Selesai Pemeriksaan & Buat Resep
                            </button>
                        </form>
                    </section>

                    <!-- KANAN: ANTREAN & STRUK -->
                    <aside class="space-y-6">
                        
                        <!-- Widget Antrean Selanjutnya -->
                        <div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h3 class="mb-4 text-lg font-bold text-slate-900">Antrean Berikutnya</h3>
                            <div class="space-y-3">
                                {#each patientQueue.slice(1) as patient (patient.id)}
                                    <div class={`flex items-center justify-between rounded-xl border-l-4 bg-slate-50 p-3 shadow-sm ${patient.isUrgent ? 'border-l-rose-500' : 'border-l-amber-400'}`}>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <p class="font-bold text-slate-900">{patient.name}</p>
                                                {#if patient.isUrgent}
                                                    <span class="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-600">Prioritas</span>
                                                {/if}
                                            </div>
                                            <p class="text-xs font-medium text-slate-500">{patient.time} • {patient.complaint}</p>
                                        </div>
                                        <button class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-100">Panggil</button>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Struk Digital (Tetap dipertahankan dengan UI gelap yang keren) -->
                        <div class="rounded-[24px] bg-slate-900 p-5 text-white shadow-lg sm:p-6">
                            <div class="mb-4 flex items-center justify-between border-b border-slate-700 pb-4">
                                <div>
                                    <h3 class="text-lg font-bold">Struk Digital</h3>
                                    <p class="text-xs text-slate-400">Pratinjau resep pasien</p>
                                </div>
                                {#if receiptVisible}
                                    <button type="button" class="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold hover:bg-sky-400" onclick={printReceipt}>Print PDF</button>
                                {/if}
                            </div>

                            {#if receiptVisible}
                                <div class="receipt-print-shell mt-2 rounded-2xl bg-white p-4 text-slate-900 shadow-inner">
                                    <div class="receipt-print-card mx-auto w-full max-w-[280px] rounded-[16px] border border-slate-200 bg-[#fffdf8] p-3">
                                        <div class="text-center">
                                            <p class="text-[11px] font-black uppercase tracking-[0.35em]">RS Medika Sehat</p>
                                            <p class="mt-1 text-[9px] uppercase tracking-[0.3em] text-slate-500">Resep Dokter</p>
                                        </div>
                                        <hr class="receipt-print-divider" />
                                        <div class="text-[10px] text-slate-600">
                                            <p><span class="font-bold text-slate-900">Pasien:</span> {activePatient.name}</p>
                                            <p><span class="font-bold text-slate-900">Diagnosa:</span> {diagnosis}</p>
                                            
                                            <div class="mt-3">
                                                <p class="font-bold uppercase tracking-[0.2em] text-slate-900">Daftar Obat</p>
                                                <ul class="mt-2 space-y-2">
                                                    {#each selectedMedicines as item (item.name)}
                                                        <li class="receipt-print-line-item">
                                                            <p class="font-bold text-slate-900">{item.name}</p>
                                                            <p class="text-[9px] text-slate-500">{item.usage || 'Aturan tidak tertulis'}</p>
                                                        </li>
                                                    {/each}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {:else}
                                <div class="rounded-xl border-2 border-dashed border-slate-700 p-8 text-center text-slate-400 text-sm">
                                    Selesaikan pemeriksaan untuk melihat struk resep.
                                </div>
                            {/if}
                        </div>
                    </aside>
                </div>
			<!-- ===================== -->
			<!-- MENU 2: JADWAL PRAKTIK & JANJI TEMU -->
			<!-- ===================== -->				
			{:else if activeMenu == 'jadwal'}
				<div class="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
					
					<!-- KIRI: DAFTAR JANJI TEMU PASIEN -->
					<section class="flex flex-col gap-5">
						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
							<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
								<div>
									<h2 class="text-xl font-bold text-slate-900">Daftar Janji Temu</h2>
									<p class="text-sm text-slate-500">Jadwal konsultasi pasien yang telah terkonfirmasi</p>
								</div>
								<!-- Filter/Tab Ringkas -->
								<div class="flex gap-2 rounded-xl bg-slate-100 p-1">
									<button class="rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-slate-900 shadow-sm">Hari Ini</button>
									<button class="rounded-lg px-4 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-900">Semua</button>
								</div>
							</div>

							<div class="space-y-4">
								{#each doctorAppointments as appt (appt.id)}
									<div class={`flex flex-col gap-4 rounded-2xl border p-5 transition-all sm:flex-row sm:items-center sm:justify-between ${appt.status === 'Menunggu' ? 'border-sky-200 bg-sky-50/30 hover:border-sky-300' : appt.status === 'Dibatalkan' ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
										
										<!-- Info Pasien -->
										<div class="flex gap-4">
											<div class={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold ${appt.status === 'Menunggu' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
												{appt.patientName.charAt(0)}
											</div>
											<div>
												<h3 class="font-bold text-slate-900">{appt.patientName}</h3>
												<p class="text-xs font-medium text-slate-500">{appt.type}</p>
												<div class="mt-2 flex items-center gap-3 text-xs font-bold text-slate-600">
													<span class="flex items-center gap-1">📅 {appt.date}</span>
													<span class="flex items-center gap-1">⏰ {appt.time}</span>
												</div>
											</div>
										</div>

										<!-- Aksi & Status -->
										<div class="flex flex-col items-start gap-2 sm:items-end">
											<span class={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
												appt.status === 'Menunggu' ? 'bg-amber-100 text-amber-700' : 
												appt.status === 'Terjadwal' ? 'bg-emerald-100 text-emerald-700' : 
												'bg-rose-100 text-rose-700'
											}`}>
												{appt.status}
											</span>
											
											{#if appt.status !== 'Dibatalkan'}
												<div class="mt-2 flex gap-2">
													{#if appt.date === 'Hari Ini'}
														<button onclick={() => activeMenu = 'beranda'} class="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700">Mulai Periksa</button>
													{/if}
													<button onclick={() => cancelAppointment(appt.id)} class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-rose-600">Batalkan</button>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</section>

					<!-- KANAN: FORM ATUR JADWAL (CRUD Create/Update) -->
					<aside class="space-y-6">
						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
							<div class="mb-5 border-b border-slate-100 pb-4">
								<h3 class="text-lg font-bold text-slate-900">Atur Jam Praktik</h3>
								<p class="text-xs text-slate-500">Buka slot antrean untuk pasien</p>
							</div>

							<form onsubmit={handleSaveSchedule} class="space-y-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Tanggal Praktik</span>
									<input type="date" bind:value={scheduleForm.date} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>

								<div class="grid grid-cols-2 gap-4">
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Jam Mulai</span>
										<input type="time" bind:value={scheduleForm.startTime} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
									</label>
									<label class="block">
										<span class="mb-1.5 block text-sm font-bold text-slate-700">Jam Selesai</span>
										<input type="time" bind:value={scheduleForm.endTime} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
									</label>
								</div>

								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Maksimal Pasien (Kuota)</span>
									<input type="number" min="1" max="100" bind:value={scheduleForm.quota} required class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" />
								</label>

								<button type="submit" class="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition hover:bg-slate-800">
									Simpan Jadwal
								</button>
							</form>
						</div>

						<!-- Info Cepat -->
						<div class="rounded-[24px] bg-sky-900 p-6 text-white shadow-lg">
							<h3 class="font-bold text-sky-100">Informasi Sistem</h3>
							<p class="mt-2 text-sm leading-relaxed text-sky-200">
								Pasien hanya dapat membuat janji temu pada slot jam praktik yang telah Anda buka di atas. Jika Anda membatalkan janji, sistem akan otomatis mengirimkan notifikasi ke aplikasi pasien.
							</p>
						</div>
					</aside>
				</div>
            <!-- ============================== -->
            <!-- MENU 3: DAFTAR PASIEN (DOKTER) -->
            <!-- ============================== -->            
			{:else if activeMenu == 'pasien'}
                <div class="space-y-6">
                    
                    <!-- Header & Pencarian -->
                    <div class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
                        <div>
                            <h2 class="text-xl font-bold text-slate-900">Database Pasien</h2>
                            <p class="mt-1 text-sm text-slate-500">Cari rekam medis dan riwayat kunjungan pasien Anda di RS Medika Sehat.</p>
                        </div>
                        
                        <div class="w-full sm:w-72">
                            <input 
                                bind:value={patientSearchQuery} 
                                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" 
                                placeholder="Cari nama atau No. RM..." 
                            />
                        </div>
                    </div>

                    <!-- Daftar Kartu Pasien -->
                    <div class="grid gap-4 md:grid-cols-2">
                        {#each filteredPatients as patient (patient.id)}
                            <div class="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300">
                                <div>
                                    <!-- Header Kartu -->
                                    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <span class="rounded-lg bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">RM: {patient.id}</span>
                                        <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                            {patient.status}
                                        </span>
                                    </div>

                                    <!-- Informasi Identitas & Diagnosa -->
                                    <div class="mt-4 space-y-2">
                                        <div class="flex items-baseline justify-between">
                                            <h3 class="text-lg font-bold text-slate-900">{patient.name}</h3>
                                            <span class="text-xs font-semibold text-slate-400">{patient.gender}, {patient.age} thn</span>
                                        </div>
                                        
                                        <div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
                                            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnosa Terakhir</p>
                                            <p class="mt-1 text-sm font-semibold text-slate-800">{patient.diagnosis}</p>
                                        </div>

                                        <p class="flex items-center gap-2 text-xs font-medium text-slate-500 pt-1">
                                            <span>📅</span> Kunjungan Terakhir: {patient.lastVisit} &nbsp;|&nbsp; <span>📞</span> {patient.phone}
                                        </p>
                                    </div>
                                </div>

                                <!-- Tombol Aksi Cepat -->
                                <div class="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                                    <button onclick={() => activeMenu = 'beranda'} class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">Buat Resep Baru</button>
                                    <button class="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700">Lihat Rekam Medis</button>
                                </div>
                            </div>
                        {:else}
                            <div class="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-400">
                                Tidak ada pasien yang ditemukan dengan kata kunci tersebut.
                            </div>
                        {/each}
                    </div>
                </div>            
            {/if}
        </div>
    </main>
</div>