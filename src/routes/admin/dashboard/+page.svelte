<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonAdmin from '$lib/components/skeleton/DashboardSkeletonAdmin.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';

	type DashboardUser = { role: string; name: string; id: string };

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<DashboardUser>({ role: 'admin', name: '', id: '' });

	onMount(async () => {
		try {
			const profile = await validateSession();

			// Cek role secara ketat di client-side
			if (profile.role.toLowerCase() !== 'admin') {
				isForbidden = true;
			} else {
				currentUser = profile;
			}
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true; // Anggap terlarang jika gagal koneksi/token mati
		} finally {
			isLoading = false;
		}
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// --- DUMMY DATA FOR ADMIN ---
	let staffList = $state([
		{ id: 'STF-001', name: 'Dr. Ahmad', role: 'Dokter', dept: 'Poli Umum', status: 'Aktif' },
		{ id: 'STF-002', name: 'Siti Nurse', role: 'Perawat', dept: 'IGD', status: 'Aktif' },
		{ id: 'STF-003', name: 'Budi Apoteker', role: 'Apoteker', dept: 'Farmasi', status: 'Non-Aktif' }
	]);

	let depts = $state([
		{ id: 'DEP-01', name: 'Poli Umum', head: 'Dr. Ahmad', staffCount: 5 },
		{ id: 'DEP-02', name: 'Poli Gigi', head: 'Drg. Lisa', staffCount: 3 },
		{ id: 'DEP-03', name: 'Farmasi', head: 'Budi Apoteker', staffCount: 4 }
	]);

	let searchQuery = $state('');
</script>

<Title title="Admin | Dashboard" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="admin"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(m) => (activeMenu = m)}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex h-full flex-1 flex-col overflow-hidden">
		<!-- Header Mobile -->
		{#if !isForbidden}
			<header
				class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden"
			>
				<button onclick={() => (isSidebarOpen = true)} class="text-sky-700">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-7 w-7"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
						/></svg
					>
				</button>
				<div
					class="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
				>
					ID: {currentUser.id}
				</div>
			</header>
		{/if}

		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10' : ''}>
			{#if isLoading}
				<DashboardSkeletonAdmin />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- HIGHLIGHT BANNER: PANEL ADMIN -->
				<div
					class="relative mb-8 overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-900 via-sky-900 to-cyan-800 p-6 text-white shadow-xl sm:p-8"
				>
					<div
						class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl"
					></div>
					<div class="absolute right-5 bottom-0 opacity-10">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-32 w-32"
							><path
								fill-rule="evenodd"
								d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm14.024-.983a1.125 1.125 0 010 1.966l-5.603 3.113A1.125 1.125 0 019 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113z"
								clip-rule="evenodd"
							/></svg
						>
					</div>

					<div
						class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
					>
						<div>
							<div class="mb-3 flex items-center gap-2">
								<span class="relative flex h-2.5 w-2.5">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"
									></span>
									<span
										class="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
									></span>
								</span>
								<p class="text-[11px] font-bold tracking-widest text-sky-200 uppercase">
									Panel Operasional
								</p>
							</div>
							<h1 class="text-3xl font-black sm:text-4xl">
								Halo, {currentUser.name || 'Admin'}! 🛡️
							</h1>
							<p class="mt-2 text-sm text-slate-300 sm:text-base">
								Kelola staf, departemen, dan data master poliklinik RS Medika Sehat.
							</p>
						</div>
					</div>
				</div>

				<!-- BERANDA ADMIN -->
				{#if activeMenu === 'beranda'}
					<section class="mb-6 grid gap-4 sm:grid-cols-4">
						<div class="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Staf</p>
							<p class="mt-3 text-3xl font-black text-sky-600">124</p>
						</div>
						<div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Poli Aktif</p>
							<p class="mt-3 text-3xl font-black text-emerald-600">12</p>
						</div>
						<div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Jadwal Praktik</p>
							<p class="mt-3 text-3xl font-black text-amber-600">45</p>
						</div>
						<div class="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Tiket Dukungan</p>
							<p class="mt-3 text-3xl font-black text-rose-600">3</p>
						</div>
					</section>

					<div class="grid gap-6 xl:grid-cols-2">
						<!-- Quick Actions -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<h2 class="mb-4 text-xl font-bold text-slate-900">Aksi Cepat</h2>
							<div class="space-y-3">
								<button
									onclick={() => (activeMenu = 'registrasi-staf')}
									class="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
								>
									<p class="font-bold text-slate-800">Daftarkan Staf Baru</p>
									<p class="mt-1 text-xs text-slate-500">
										Buat akun untuk dokter, perawat, atau apoteker.
									</p>
								</button>
								<button
									onclick={() => (activeMenu = 'reset-password')}
									class="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
								>
									<p class="font-bold text-slate-800">Reset Password Staf</p>
									<p class="mt-1 text-xs text-slate-500">Bantu staf yang lupa kata sandinya.</p>
								</button>
							</div>
						</section>

						<!-- Recent Activity -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<h2 class="mb-4 text-xl font-bold text-slate-900">Aktivitas Terkini</h2>
							<ul class="space-y-4">
								<li class="flex gap-3 text-sm">
									<div class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"></div>
									<div>
										<p class="font-bold text-slate-800">Dr. Budi menambahkan jadwal</p>
										<p class="text-xs text-slate-500">Poli Gigi - 10 Menit yang lalu</p>
									</div>
								</li>
								<li class="flex gap-3 text-sm">
									<div class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"></div>
									<div>
										<p class="font-bold text-slate-800">Siti Nurse terdaftar di IGD</p>
										<p class="text-xs text-slate-500">Oleh Admin Utama - 1 Jam yang lalu</p>
									</div>
								</li>
							</ul>
						</section>
					</div>

					<!-- REGISTRASI STAF -->
				{:else if activeMenu === 'registrasi-staf'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<h2 class="mb-2 text-xl font-bold text-slate-900">Registrasi Staf Baru</h2>
						<p class="mb-6 text-sm text-slate-500">
							Tambahkan dokter, perawat, atau apoteker ke dalam sistem.
						</p>

						<form class="max-w-2xl space-y-4">
							<div class="grid grid-cols-2 gap-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Nama Lengkap</span>
									<input
										required
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									/>
								</label>
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Email (Username)</span
									>
									<input
										type="email"
										required
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									/>
								</label>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Peran / Role</span>
									<select
										required
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									>
										<option value="dokter">Dokter</option>
										<option value="perawat">Perawat</option>
										<option value="apoteker">Apoteker</option>
									</select>
								</label>
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700">Departemen Utama</span
									>
									<select
										required
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
									>
										{#each depts as d}
											<option value={d.id}>{d.name}</option>
										{/each}
									</select>
								</label>
							</div>
							<button
								type="submit"
								class="mt-4 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-sky-700"
							>
								Daftarkan Akun Staf
							</button>
						</form>
					</section>

					<!-- MANAJEMEN DEPARTEMEN -->
				{:else if activeMenu === 'departemen'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex items-center justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Departemen</h2>
								<p class="text-sm text-slate-500">Kelola poli dan pembagian divisi.</p>
							</div>
							<button
								class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
								>+ Tambah Poli Baru</button
							>
						</div>

						<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{#each depts as dept}
								<div class="rounded-xl border border-slate-200 p-5 transition hover:border-sky-300">
									<div class="mb-3 flex items-start justify-between">
										<h3 class="font-bold text-slate-900">{dept.name}</h3>
										<span
											class="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
											>{dept.id}</span
										>
									</div>
									<p class="text-sm text-slate-500">Kepala: <strong>{dept.head}</strong></p>
									<p class="text-sm text-slate-500">
										Total Staf: <strong>{dept.staffCount}</strong>
									</p>
									<div class="mt-4 flex gap-2">
										<button class="text-xs font-bold text-sky-600 hover:underline">Edit</button>
										<button class="text-xs font-bold text-rose-600 hover:underline">Hapus</button>
									</div>
								</div>
							{/each}
						</div>
					</section>

					<!-- RESET PASSWORD -->
				{:else if activeMenu === 'reset-password'}
					<section class="max-w-2xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<h2 class="mb-2 text-xl font-bold text-slate-900">Reset Kata Sandi Staf</h2>
						<p class="mb-6 text-sm text-slate-500">
							Pilih staf untuk mereset kata sandi ke default atau sandi sementara.
						</p>

						<div class="mb-4">
							<input
								bind:value={searchQuery}
								placeholder="Cari ID Staf atau Nama..."
								class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
							/>
						</div>

						<div class="divide-y rounded-xl border">
							{#each staffList as staff}
								<div class="flex items-center justify-between p-4 hover:bg-slate-50">
									<div>
										<p class="font-bold text-slate-800">
											{staff.name} <span class="text-xs text-slate-500">({staff.role})</span>
										</p>
										<p class="text-xs text-slate-400">{staff.id} • {staff.dept}</p>
									</div>
									<button
										class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
										>Reset Sandi</button
									>
								</div>
							{/each}
						</div>
					</section>

					<!-- DATA MASTER -->
				{:else if activeMenu === 'data-master'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<h2 class="mb-2 text-xl font-bold text-slate-900">Data Master Poli & Jadwal Default</h2>
						<p class="mb-6 text-sm text-slate-500">Konfigurasi data inti sistem operasional.</p>

						<div
							class="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="mx-auto mb-3 h-12 w-12 text-slate-300"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/></svg
							>
							<p class="font-bold">Modul Dalam Pengembangan</p>
							<p class="text-sm">
								Integrasi Master Data (Tindakan, Obat, Diagnosa ICD-10) akan tersedia di rilis
								berikutnya.
							</p>
						</div>
					</section>
				{/if}
			{/if}
		</div>
	</main>
</div>
