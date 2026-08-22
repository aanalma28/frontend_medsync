<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonSuperadmin from '$lib/components/skeleton/DashboardSkeletonSuperadmin.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';

	type DashboardUser = { role: string; name: string; id: string };

	let isLoading = $state(true);
	let currentUser = $state<DashboardUser>({ role: 'superadmin', name: '', id: '' });

	onMount(async () => {
		try {
			const profile = await validateSession();
			// Optional: You could redirect if profile.role is not 'superadmin'
			currentUser = profile;
			isLoading = false;
		} catch {
			isLoading = false;
		}
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// --- DUMMY DATA FOR SUPERADMIN ---
	let branches = $state([
		{
			id: 'BR-JKT',
			name: 'RS Medika Sehat Jakarta',
			status: 'Operasional',
			revenue: 'Rp 2.5B',
			patients: 1250
		},
		{
			id: 'BR-SBY',
			name: 'RS Medika Sehat Surabaya',
			status: 'Operasional',
			revenue: 'Rp 1.8B',
			patients: 950
		},
		{
			id: 'BR-BDG',
			name: 'RS Medika Sehat Bandung',
			status: 'Maintenance',
			revenue: 'Rp 800M',
			patients: 400
		}
	]);

	let activeAdmins = $state([
		{
			id: 'ADM-001',
			name: 'Farhan',
			email: 'farhan@medika.com',
			branch: 'Jakarta',
			status: 'Aktif'
		},
		{
			id: 'ADM-002',
			name: 'Lestari',
			email: 'lestari@medika.com',
			branch: 'Surabaya',
			status: 'Aktif'
		},
		{
			id: 'ADM-003',
			name: 'Bayu',
			email: 'bayu@medika.com',
			branch: 'Bandung',
			status: 'Non-Aktif'
		}
	]);
</script>

<Title title="Superadmin | Dashboard" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else}
		<Sidebar
			role="superadmin"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(m) => (activeMenu = m)}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex h-full flex-1 flex-col overflow-hidden">
		<!-- Header Mobile -->
		<header
			class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden"
		>
			<button onclick={() => (isSidebarOpen = true)} class="text-slate-700">
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
			<div class="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
				Superadmin: {currentUser.id}
			</div>
		</header>

		<div class="flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10">
			{#if isLoading}
				<DashboardSkeletonSuperadmin />
			{:else}
				<!-- HIGHLIGHT BANNER: SUPERADMIN -->
				<div
					class="relative mb-8 overflow-hidden rounded-[24px] bg-slate-900 p-6 text-white shadow-xl sm:p-8"
				>
					<div
						class="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"
					></div>
					<div class="absolute right-0 bottom-0 opacity-5">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-48 w-48"
							><path
								fill-rule="evenodd"
								d="M12 1.5a.75.75 0 01.75.75v19.5a.75.75 0 01-1.5 0V2.25A.75.75 0 0112 1.5zM3.604 4.542a.75.75 0 00-.75.75v6.52c0 4.148 2.502 7.72 6.142 9.215a.75.75 0 00.569 0c3.64-1.495 6.142-5.067 6.142-9.215v-6.52a.75.75 0 00-.75-.75h-11.3z"
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
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"
									></span>
									<span
										class="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
									></span>
								</span>
								<p class="text-[11px] font-bold tracking-widest text-slate-300 uppercase">
									Akses Strategis
								</p>
							</div>
							<h1 class="text-3xl font-black sm:text-4xl">Dashboard Strategis 🌐</h1>
							<p class="mt-2 text-sm text-slate-400 sm:text-base">
								Pengawasan lintas cabang, analitik bisnis, dan konfigurasi sistem inti.
							</p>
						</div>
					</div>
				</div>

				<!-- BERANDA SUPERADMIN -->
				{#if activeMenu === 'beranda'}
					<section class="mb-6 grid gap-4 sm:grid-cols-4">
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Cabang</p>
							<p class="mt-3 text-3xl font-black text-slate-900">{branches.length}</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">100% Online</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Pasien (Global)</p>
							<p class="mt-3 text-3xl font-black text-slate-900">2,600</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">+15% Bulan ini</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Admin Operasional</p>
							<p class="mt-3 text-3xl font-black text-slate-900">{activeAdmins.length}</p>
							<p class="mt-1 text-xs font-semibold text-slate-500">Aktif di 3 cabang</p>
						</div>
						<div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
							<p class="text-sm font-bold text-indigo-800">Pendapatan (Bulan Ini)</p>
							<p class="mt-3 text-3xl font-black text-indigo-900">Rp 5.1B</p>
						</div>
					</section>

					<div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
						<!-- Chart Area -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div class="mb-8 flex items-center justify-between">
								<div>
									<h2 class="text-xl font-bold text-slate-900">Grafik Kunjungan Pasien</h2>
									<p class="text-sm text-slate-500">Agregasi dari seluruh cabang</p>
								</div>
								<select
									class="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 pl-3 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
									style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.5em 1.5em;"
								>
									<option>Bulan Ini</option>
									<option>Tahun Ini</option>
								</select>
							</div>

							<div class="mt-8 flex h-64 items-end justify-between gap-2">
								<!-- Dummy Bar Chart -->
								{#each [40, 70, 45, 90, 65, 85, 100] as height, i}
									<div
										class="group relative flex h-full w-full cursor-pointer flex-col justify-end"
									>
										<div
											class="w-full rounded-t-lg bg-indigo-100 transition-all group-hover:bg-indigo-200"
											style="height: {height}%"
										>
											<div
												class="absolute -top-8 w-full text-center text-xs font-bold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100"
											>
												{height * 12}
											</div>
										</div>
									</div>
								{/each}
							</div>
							<div
								class="mt-2 flex justify-start text-xs font-semibold text-slate-400 md:justify-between"
							>
								<span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span
								><span>Sab</span><span>Min</span>
							</div>
						</section>

						<!-- List Cabang -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<h2 class="mb-4 text-xl font-bold text-slate-900">Status Cabang</h2>
							<ul class="space-y-4">
								{#each branches as branch}
									<li class="flex items-center justify-between border-b border-slate-50 pb-3">
										<div>
											<h3 class="font-bold text-slate-800">{branch.name}</h3>
											<p class="text-xs text-slate-500">Pendapatan: {branch.revenue}</p>
										</div>
										<span
											class={`rounded-md px-2 py-1 text-[10px] font-black tracking-wider uppercase ${branch.status === 'Operasional' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
										>
											{branch.status}
										</span>
									</li>
								{/each}
							</ul>
						</section>
					</div>

					<!-- MANAJEMEN ADMIN -->
				{:else if activeMenu === 'admin-mgmt'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex items-center justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Admin Operasional</h2>
								<p class="text-sm text-slate-500">
									Kelola akses administrator untuk setiap cabang.
								</p>
							</div>
							<button
								class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
								>+ Tambah Admin</button
							>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-sm">
								<thead class="bg-slate-50 text-slate-500">
									<tr>
										<th class="rounded-tl-lg px-4 py-3 font-semibold">ID</th>
										<th class="px-4 py-3 font-semibold">Nama / Email</th>
										<th class="px-4 py-3 font-semibold">Cabang</th>
										<th class="px-4 py-3 font-semibold">Status</th>
										<th class="rounded-tr-lg px-4 py-3 text-right font-semibold">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each activeAdmins as admin}
										<tr class="transition hover:bg-slate-50">
											<td class="px-4 py-3 font-bold text-slate-900">{admin.id}</td>
											<td class="px-4 py-3">
												<p class="font-bold text-slate-800">{admin.name}</p>
												<p class="text-xs text-slate-500">{admin.email}</p>
											</td>
											<td class="px-4 py-3">{admin.branch}</td>
											<td class="px-4 py-3">
												<span
													class={`rounded-full px-2.5 py-1 text-[10px] font-bold ${admin.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
													>{admin.status}</span
												>
											</td>
											<td class="px-4 py-3 text-right">
												<button class="mr-3 font-bold text-sky-600 hover:underline">Edit</button>
												{#if admin.status === 'Aktif'}
													<button class="font-bold text-amber-600 hover:underline"
														>Nonaktifkan</button
													>
												{:else}
													<button class="font-bold text-emerald-600 hover:underline"
														>Aktifkan</button
													>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>

					<!-- LAPORAN FINANSIAL -->
				{:else if activeMenu === 'reports'}
					<section
						class="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-sm"
					>
						<h2 class="mb-2 text-xl font-bold text-slate-900">Laporan Finansial & Bisnis</h2>
						<div class="py-12">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="mx-auto mb-4 h-16 w-16 text-slate-300"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
								/></svg
							>
							<p class="font-bold text-slate-700">Modul Rekap Finansial (TBA)</p>
							<p class="mt-2 text-sm text-slate-500">
								Integrasi dengan sistem payment gateway sedang diproses.
							</p>
							<button
								class="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
								>Ekspor Data Sementara (CSV)</button
							>
						</div>
					</section>

					<!-- PENGATURAN GLOBAL -->
				{:else if activeMenu === 'settings'}
					<section class="max-w-3xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<h2 class="mb-6 text-xl font-bold text-slate-900">Pengaturan Sistem Global</h2>

						<div class="space-y-6 divide-y divide-slate-100">
							<!-- Backup -->
							<div class="flex items-center justify-between pb-4">
								<div>
									<p class="font-bold text-slate-800">Backup Database Terjadwal</p>
									<p class="mt-1 text-sm text-slate-500">
										Lakukan backup otomatis setiap jam 02:00 AM
									</p>
								</div>
								<!-- Toggle -->
								<label for="toggle1" class="mr-2 flex cursor-pointer items-center">
									<div class="relative">
										<input type="checkbox" id="toggle1" class="peer sr-only" checked />
										<div
											class="block h-6 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500"
										></div>
										<div
											class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"
										></div>
									</div>
								</label>
							</div>

							<!-- Maintenance -->
							<div class="flex items-center justify-between pt-4 pb-4">
								<div>
									<p class="font-bold text-slate-800">Mode Perawatan (Maintenance Mode)</p>
									<p class="mt-1 text-sm text-slate-500">
										Hanya Superadmin yang dapat login, user lain akan melihat halaman perbaikan.
									</p>
								</div>
								<label for="toggle2" class="mr-2 flex cursor-pointer items-center">
									<div class="relative">
										<input type="checkbox" id="toggle2" class="peer sr-only" />
										<div
											class="block h-6 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500"
										></div>
										<div
											class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"
										></div>
									</div>
								</label>
							</div>

							<!-- Log retention -->
							<div class="pt-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700"
										>Retensi Log Sistem (Hari)</span
									>
									<input
										type="number"
										value="30"
										class="w-full max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
									/>
								</label>
								<button
									class="mt-4 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-800"
									>Simpan Pengaturan</button
								>
							</div>
						</div>
					</section>
				{/if}
			{/if}
		</div>
	</main>
</div>
