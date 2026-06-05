<script lang="ts">
    import { browser } from '$app/environment';
    import Sidebar from '$lib/components/Sidebar.svelte';

    type PrescriptionStatus = 'Menunggu' | 'Siap ambil' | 'Selesai';
    
    function readCookie(name: string) {
        if (!browser || typeof document === 'undefined') return '';
        const cookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.substring(name.length + 1)) : '';
    }

    let currentUser = $state({ 
        role: 'apoteker', 
        name: readCookie('medsync_name') || 'Apoteker', 
        id: readCookie('medsync_user_id') || 'APT-001' 
    });
    
    let activeMenu = $state('beranda');
    let isSidebarOpen = $state(false);

    // DATA DUMMY DENGAN FLAG PRIORITAS/URGENT
    let prescriptions = $state([
        { id: 1, patient: 'Ayu Putri', doctor: 'dr. Nanda', time: '08:15 WIB', waitTime: '45 mnt', status: 'Menunggu' as PrescriptionStatus, isUrgent: true, medicines: ['Paracetamol 500mg', 'Amoxicillin 500mg'] },
        { id: 2, patient: 'Bapak Sudirman', doctor: 'dr. Arif', time: '08:50 WIB', waitTime: '10 mnt', status: 'Menunggu' as PrescriptionStatus, isUrgent: false, medicines: ['Isosorbide Dinitrate 5mg'] },
        { id: 3, patient: 'Rizky Pratama', doctor: 'dr. Lina', time: '08:00 WIB', waitTime: '-', status: 'Siap ambil' as PrescriptionStatus, isUrgent: false, medicines: ['Omeprazole 20mg'] }
    ]);

    let inventory = $state([
        { name: 'Paracetamol 500mg', category: 'Analgesik', quantity: 42, note: 'Stok aman' },
        { name: 'Omeprazole 20mg', category: 'Pencernaan', quantity: 6, note: 'Stok Kritis' }
    ]);

    let pickupQueue = $state([
        { patient: 'Rizky Pratama', medicine: 'Omeprazole 20mg', time: 'Menunggu di Loket' }
    ]);
    
    let searchQuery = $state('');
    let verifyNote = $state('');
    let verifiedIds = $state<number[]>([]);

    let filteredPrescriptions = $derived(
        prescriptions.filter(item => item.patient.toLowerCase().includes(searchQuery.toLowerCase()) || item.medicines.some(m => m.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    // Mengambil resep prioritas pertama (yang Urgent dan Menunggu)
    let urgentPrescription = $derived(prescriptions.find(p => p.status === 'Menunggu' && p.isUrgent) || prescriptions.find(p => p.status === 'Menunggu'));

    function updateStatus(id: number, status: PrescriptionStatus) {
        prescriptions = prescriptions.map(item => (item.id === id ? { ...item, status } : item));
        if(status === 'Siap ambil' && !pickupQueue.find(p => p.patient === prescriptions.find(x => x.id === id)?.patient)) {
            const p = prescriptions.find(x => x.id === id)!;
            pickupQueue = [...pickupQueue, { patient: p.patient, medicine: p.medicines[0], time: 'Baru Saja Siap' }];
        }
    }

    function toggleVerification(id: number) {
        verifiedIds = verifiedIds.includes(id) ? verifiedIds.filter(itemId => itemId !== id) : [...verifiedIds, id];
    }

    // --- STATE MENU KELOLA PENGGUNA (APOTEKER) ---
    let userSearchQuery = $state('');
    let patientUsers = $state([
        { id: 'BP-2054', name: 'Ayu Putri', phone: '0812-3456-7890', bpjs: '0001234567891', status: 'Aktif' },
        { id: 'BP-2055', name: 'Rizky Pratama', phone: '0813-9876-5432', bpjs: '0009876543212', status: 'Aktif' },
        { id: 'BP-2056', name: 'Dewi Sartika', phone: '0821-1122-3344', bpjs: '-', status: 'Umum' }
    ]);

    let filteredUsers = $derived(
        patientUsers.filter(u => 
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
            u.id.toLowerCase().includes(userSearchQuery.toLowerCase())
        )
    );
</script>

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
    <Sidebar role="admin" activeMenu={activeMenu} isOpen={isSidebarOpen} onMenuSelect={(m) => activeMenu = m} onClose={() => isSidebarOpen = false} />

    <main class="flex-1 flex flex-col h-full overflow-hidden">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button onclick={() => isSidebarOpen = true} class="text-amber-700"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-7 w-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg></button>
            <div class="rounded-full bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">ID: {currentUser.id}</div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10">
            
            <!-- HEADER HERO APOTEKER -->
            <div class="mb-8 relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 via-stone-900 to-amber-900 p-6 text-white shadow-xl sm:p-8">
                <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl"></div>
                <div class="absolute bottom-0 right-5 opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-32 w-32"><path d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-.46-.46V20.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-7.06l-.46.46a.75.75 0 11-1.06-1.06l8.99-9zM12 7.5a.75.75 0 00-.75.75v1.5H9.75a.75.75 0 000 1.5h1.5v1.5a.75.75 0 001.5 0v-1.5h1.5a.75.75 0 000-1.5h-1.5v-1.5A.75.75 0 0012 7.5z" /></svg>
                </div>
                
                <div class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div class="mb-3 flex items-center gap-2">
                            <span class="relative flex h-2.5 w-2.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span></span>
                            <p class="text-[11px] font-bold uppercase tracking-widest text-amber-200">Sistem Farmasi Aktif</p>
                        </div>
                        <h1 class="text-3xl font-black sm:text-4xl">Halo, Apoteker {currentUser.name}! 💊</h1>
                        <p class="mt-2 text-sm text-slate-300 sm:text-base">Ada <strong class="text-white">{prescriptions.filter(p => p.status === 'Menunggu').length} resep</strong> menunggu diracik, dan <strong class="text-white">{pickupQueue.length} pasien</strong> di loket.</p>
                    </div>
                    <div class="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-md shadow-inner">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">ID Apoteker</p>
                        <p class="mt-0.5 text-lg font-black tracking-wider text-white">{currentUser.id}</p>
                    </div>
                </div>
            </div>
            <!-- ===================== -->
			<!-- MENU 1: BERANDA	   -->
			<!-- ===================== -->
            {#if activeMenu === 'beranda'}
                <!-- STATISTIK -->
                <section class="mb-6 grid gap-4 sm:grid-cols-3">
                    <div class="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
                        <p class="text-sm font-bold text-slate-500">Antrean Resep</p>
                        <p class="mt-2 text-3xl font-black text-rose-600">{prescriptions.filter(p => p.status === 'Menunggu').length}</p>
                    </div>
                    <div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                        <p class="text-sm font-bold text-slate-500">Siap Serah Terima</p>
                        <p class="mt-2 text-3xl font-black text-emerald-600">{prescriptions.filter(p => p.status === 'Siap ambil').length}</p>
                    </div>
                    <div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                        <p class="text-sm font-bold text-slate-500">Total Pasien Hari Ini</p>
                        <p class="mt-2 text-3xl font-black text-amber-600">{prescriptions.length}</p>
                    </div>
                </section>

                <!-- MODUL FOKUS UTAMA (EYE-CATCHING) -->
                {#if urgentPrescription}
                    <section class="mb-6 rounded-[24px] border-2 border-rose-500 bg-rose-50 p-6 shadow-lg sm:p-8">
                        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div class="mb-2 flex items-center gap-2">
                                    <span class="rounded bg-rose-200 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-800">Prioritas Racik</span>
                                    <span class="text-sm font-bold text-rose-600">Menunggu {urgentPrescription.waitTime}</span>
                                </div>
                                <h2 class="text-2xl font-black text-slate-900">{urgentPrescription.patient}</h2>
                                <p class="mt-1 text-sm font-medium text-slate-600">Dari: {urgentPrescription.doctor}</p>
                            </div>
                            <div class="rounded-xl bg-white p-4 shadow-sm md:w-1/2">
                                <p class="text-xs font-bold uppercase text-slate-400">Daftar Obat (Tindakan Segera)</p>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    {#each urgentPrescription.medicines as med (med)}
                                        <span class="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-800 border border-slate-200">{med}</span>
                                    {/each}
                                </div>
                                <button onclick={() => updateStatus(urgentPrescription.id, 'Siap ambil')} class="mt-4 w-full rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-rose-700">Tandai Selesai Diracik</button>
                            </div>
                        </div>
                    </section>
                {/if}

                <div class="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">
                    <!-- KIRI: DAFTAR RESEP -->
                    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                        <h2 class="mb-5 text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Semua Antrean Resep</h2>
                        
                        <input bind:value={searchQuery} class="mb-5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100" placeholder="Cari nama pasien atau obat..." />

                        <div class="space-y-4">
                            {#each filteredPrescriptions as p (p.id)}
                                <div class={`flex flex-col gap-4 sm:flex-row sm:justify-between rounded-xl border-l-4 bg-slate-50 p-4 shadow-sm ${p.status === 'Menunggu' ? (p.isUrgent ? 'border-l-rose-500' : 'border-l-amber-400') : 'border-l-emerald-400'}`}>
                                    <div>
                                        <div class="flex items-center gap-2 mb-1">
                                            <p class="font-bold text-slate-900">{p.patient}</p>
                                            <span class={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${p.status === 'Menunggu' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>{p.status}</span>
                                        </div>
                                        <p class="text-xs font-medium text-slate-500">Waktu: {p.time} • Dokter: {p.doctor}</p>
                                        <div class="mt-2 flex flex-wrap gap-1">
                                            {#each p.medicines as med (med)} <span class="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">{med}</span> {/each}
                                        </div>
                                    </div>
                                    <div class="flex flex-col justify-center">
                                        {#if p.status === 'Menunggu'}
                                            <button onclick={() => updateStatus(p.id, 'Siap ambil')} class="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">Selesai Racik</button>
                                        {:else if p.status === 'Siap ambil'}
                                            <button onclick={() => updateStatus(p.id, 'Selesai')} class="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600">Diserahkan</button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </section>

                    <!-- KANAN: LOKET & STOK -->
                    <aside class="space-y-6">
                        <!-- PANGGILAN LOKET -->
                        <div class="rounded-[24px] bg-slate-900 p-5 text-white shadow-lg sm:p-6">
                            <h3 class="text-lg font-bold">Loket Penyerahan Obat</h3>
                            <p class="text-xs text-slate-400">Panggil pasien untuk ambil obat</p>
                            <div class="mt-4 space-y-3">
                                {#each pickupQueue as item (item.patient)}
                                    <div class="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 p-3">
                                        <div>
                                            <p class="font-bold text-white">{item.patient}</p>
                                            <p class="text-xs text-emerald-400">{item.time}</p>
                                        </div>
                                        <button class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold hover:bg-emerald-400">Panggil</button>
                                    </div>
                                {/each}
                                {#if pickupQueue.length === 0} <p class="text-sm text-slate-500 text-center py-4">Loket kosong</p> {/if}
                            </div>
                        </div>

                        <!-- STOK KRITIS -->
                        <div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <h3 class="mb-4 font-bold text-slate-900">Peringatan Stok Obat</h3>
                            <div class="space-y-3">
                                {#each inventory.filter(i => i.quantity < 10) as item (item.category)}
                                    <div class="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3">
                                        <div>
                                            <p class="text-sm font-bold text-slate-900">{item.name}</p>
                                            <p class="text-[10px] font-black uppercase text-rose-600">{item.note}</p>
                                        </div>
                                        <span class="rounded bg-rose-600 px-2 py-1 text-xs font-bold text-white">{item.quantity}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </aside>
                </div>
            <!-- ================================================ -->
            <!-- MENU 2: DIREKTORI & VERIFIKASI PASIEN (APOTEKER) -->
            <!-- ================================================ -->      
            {:else if activeMenu == 'users'}
                <div class="space-y-6">
                    
                    <!-- Header & Pencarian -->
                    <div class="flex flex-col gap-4 rounded-[24px] border border-amber-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
                        <div>
                            <h2 class="text-xl font-bold text-slate-900">Direktori & Verifikasi Pasien</h2>
                            <p class="mt-1 text-sm text-slate-500">Cari data pasien untuk verifikasi pengambilan resep dan validasi nomor BPJS.</p>
                        </div>
                        
                        <div class="w-full sm:w-72">
                            <input 
                                bind:value={userSearchQuery} 
                                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100" 
                                placeholder="Cari nama atau ID pasien..." 
                            />
                        </div>
                    </div>

                    <!-- Tabel Daftar Pasien -->
                    <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <th class="pb-3 px-4">ID Pasien</th>
                                        <th class="pb-3 px-4">Nama Lengkap</th>
                                        <th class="pb-3 px-4">No. Telepon / WhatsApp</th>
                                        <th class="pb-3 px-4">No. BPJS / Asuransi</th>
                                        <th class="pb-3 px-4">Status</th>
                                        <th class="pb-3 px-4 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 text-sm">
                                    {#each filteredUsers as user (user.id)}
                                        <tr class="transition hover:bg-slate-50">
                                            <td class="py-4 px-4 font-bold text-slate-900">{user.id}</td>
                                            <td class="py-4 px-4 font-semibold text-slate-800">{user.name}</td>
                                            <td class="py-4 px-4 text-slate-600">{user.phone}</td>
                                            <td class="py-4 px-4 text-slate-600">{user.bpjs}</td>
                                            <td class="py-4 px-4">
                                                <span class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{user.status}</span>
                                            </td>
                                            <td class="py-4 px-4 text-right">
                                                <button class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">Verifikasi</button>
                                            </td>
                                        </tr>
                                    {:else}
                                        <tr>
                                            <td colspan="6" class="py-8 text-center text-slate-400">Tidak ada pasien yang ditemukan.</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>            
            {/if}
        </div>
    </main>
</div>