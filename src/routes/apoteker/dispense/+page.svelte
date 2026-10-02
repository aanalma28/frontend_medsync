<script lang="ts">
	/**
	 * Dashboard Apoteker — Antrean & Validasi Resep (Dispense Management)
	 *
	 * AUTH: Nyata (backend).
	 *   - validateSession() tetap dipanggil ke backend.
	 *   - Role gate tetap: selain pharmacist/apoteker/superadmin/masteradmin → 403.
	 *
	 * DATA FITUR: DUMMY (sementara).
	 *   - Warehouse, produk, stok, resep, dan amprahan diambil dari store dummy
	 *     `$lib/stores/dispense.svelte`. Setelah backend menyiapkan response data,
	 *     cukup menukar isi fungsi fetch/action di store tersebut dengan endpoint asli
	 *     tanpa mengubah komponen ini.
	 *
	 * NAVIGASI:
	 *   - Sidebar dipakai bersama. Karena menu lain (beranda/inventory/users/
	 *     pengaturan) di-handle sebagai tab internal di /apoteker/dashboard,
	 *     klik menu selain "dispense" harus benar-benar navigasi ke halaman itu.
	 *   - Klik "dispense" tetap di route ini.
	 */
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { validateSession } from '$lib/utils/getProfile';
	import {
		dispense,
		PRESCRIPTION_PRIORITY_LABELS,
		WAREHOUSE_TYPE_LABELS,
		type PrescriptionView
	} from '$lib/stores/dispense.svelte';

	/* ================================================================ */
	/* SESSION (NYATA — ke backend)                                      */
	/* ================================================================ */

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<{ role: string; name: string; id: string; user_code?: string }>({
		role: 'apoteker',
		name: '',
		id: '',
		user_code: ''
	});

	// Route ini selalu memegang tab "dispense".
	let activeMenu = $state('dispense');
	let isSidebarOpen = $state(false);

	/* --------------------------- Notification -------------------------- */
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	function showNotification(type: 'success' | 'error', message: string) {
		notification = { type, message };
		setTimeout(() => {
			notification = null;
		}, 6000);
	}

	/* ================================================================ */
	/* SIDEBAR NAVIGATION                                                */
	/* ================================================================ */

	/**
	 * Menu yang di-host sebagai tab internal di /apoteker/dashboard.
	 * Klik menu tersebut dari halaman ini harus benar-benar pindah route.
	 */
	const DASHBOARD_MENUS = new Set(['beranda', 'inventory', 'users', 'pengaturan']);

	function handleMenuSelect(menuId: string) {
		isSidebarOpen = false;

		if (menuId === 'dispense') {
			activeMenu = 'dispense';
			return;
		}

		if (DASHBOARD_MENUS.has(menuId)) {
			// Dashboard page memegang state tab-nya sendiri; cukup arahkan ke sana.
			goto('/apoteker/dashboard');
			return;
		}

		// Fallback: menu tak dikenal — perlakukan sebagai dashboard.
		goto('/apoteker/dashboard');
	}

	/* ================================================================ */
	/* DERIVED DARI STORE DUMMY                                          */
	/* ================================================================ */

	let depoWarehouses = $derived(dispense.depoWarehouses);
	let mainWarehouse = $derived(dispense.mainWarehouse);
	let activeWarehouse = $derived(dispense.activeWarehouse);

	/** Antrean resep untuk depo aktif (sudah dievaluasi stok + diurutkan prioritas). */
	let queue = $derived(dispense.activeQueue);

	/** Stok kritis di depo aktif. */
	let lowStockProducts = $derived(dispense.lowStockProducts);

	let pendingRequests = $derived(dispense.pendingRequests);

	/* ------------------------------ Filters ---------------------------- */
	let searchQuery = $state('');
	let priorityFilter = $state<'ALL' | 'NORMAL' | 'URGENT' | 'EMERGENCY'>('ALL');

	let filteredQueue = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return queue.filter((p) => {
			const matchPriority = priorityFilter === 'ALL' || p.priority === priorityFilter;
			const matchQuery =
				q === '' ||
				p.patient_name.toLowerCase().includes(q) ||
				p.no_trx.toLowerCase().includes(q) ||
				p.medical_record_number.toLowerCase().includes(q) ||
				p.doctor_name.toLowerCase().includes(q);
			return matchPriority && matchQuery;
		});
	});

	let stats = $derived({
		pending: queue.length,
		urgent: queue.filter((p) => p.priority === 'URGENT' || p.priority === 'EMERGENCY').length,
		ready: queue.filter((p) => !p.has_shortage).length,
		shortage: queue.filter((p) => p.has_shortage).length
	});

	/* ================================================================ */
	/* MODAL STATE                                                       */
	/* ================================================================ */

	let isValidationModalOpen = $state(false);
	let selectedPrescriptionId = $state<string | null>(null);
	let verifyNotes = $state('Resep telah diverifikasi dan dosis sesuai.');
	let revealShortage = $state(false);

	/** Resep terpilih dievaluasi ulang dari store agar stok selalu live. */
	let selectedPrescription = $derived.by<PrescriptionView | null>(() => {
		if (!selectedPrescriptionId) return null;
		const raw = dispense.prescriptions.find((p) => p.id === selectedPrescriptionId);
		return raw ? dispense.evaluatePrescription(raw) : null;
	});

	/**
	 * Meta (label/badge/dot) untuk prioritas resep terpilih.
	 * Dihitung sebagai $derived agar aman dipakai langsung di template
	 * (menghindari `{@const}` yang tidak boleh berada di dalam <div>).
	 */
	let selectedPriorityMeta = $derived(priorityMeta(selectedPrescription?.priority ?? 'NORMAL'));

	let isRequestModalOpen = $state(false);
	let requestNotes = $state('');
	let requestItems = $state<
		{ product_id: string; product_name: string; unit: string; requested_qty: number; shortfall: number }[]
	>([]);

	/* ================================================================ */
	/* LIFECYCLE (auth nyata, data dummy)                                */
	/* ================================================================ */
	onMount(async () => {
		try {
			const profile = await validateSession();
			const roleLower = profile.role.toLowerCase();
			if (!['pharmacist', 'apoteker', 'superadmin', 'masteradmin'].includes(roleLower)) {
				isForbidden = true;
			} else {
				currentUser = profile;

				// Muat data dummy fitur dari store
				await dispense.fetchWarehouses();
				const depo = dispense.depoWarehouses.find((w) => w.is_active) ?? dispense.depoWarehouses[0];
				if (depo) {
					dispense.selectWarehouse(depo.id);
					await dispense.fetchPrescriptionQueue({ warehouse_id: depo.id });
				}
			}
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});

	/* ================================================================ */
	/* ACTIONS (delegasi ke store dummy)                                 */
	/* ================================================================ */

	async function handleWarehouseChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		dispense.selectWarehouse(value);
		await dispense.fetchPrescriptionQueue({ warehouse_id: value });
		showNotification(
			'success',
			`Konteks depo dipindah ke ${dispense.warehouseById(value)?.name ?? value}.`
		);
	}

	async function handleRefresh() {
		await dispense.fetchPrescriptionQueue({ warehouse_id: dispense.activeWarehouseId });
		showNotification('success', 'Antrean resep diperbarui (data dummy).');
	}

	function openValidationModal(p: PrescriptionView) {
		selectedPrescriptionId = p.id;
		revealShortage = false;
		verifyNotes = 'Resep telah diverifikasi dan dosis sesuai.';
		isValidationModalOpen = true;
	}

	function closeValidationModal() {
		isValidationModalOpen = false;
		selectedPrescriptionId = null;
		revealShortage = false;
	}

	async function handleValidate() {
		if (!selectedPrescription) return;
		const result = await dispense.validateAndDispense(selectedPrescription.id, verifyNotes);
		if (result.ok) {
			showNotification('success', result.message);
			closeValidationModal();
		} else {
			revealShortage = true;
			showNotification('error', result.message);
		}
	}

	/* --------------------------- Amprahan cepat ------------------------ */
	function openRequestModal() {
		if (!selectedPrescription) return;
		const shortages = selectedPrescription.items.filter((i) => !i.available);
		if (!shortages.length) {
			showNotification('error', 'Tidak ada item yang perlu diamprah.');
			return;
		}
		requestItems = shortages.map((i) => ({
			product_id: i.product_id,
			product_name: i.product_name,
			unit: i.unit,
			requested_qty: i.shortfall,
			shortfall: i.shortfall
		}));
		requestNotes = `Amprahan darurat untuk resep ${selectedPrescription.no_trx} (${selectedPrescription.patient_name}).`;
		isRequestModalOpen = true;
	}

	async function handleSubmitRequest() {
		if (!selectedPrescription) return;
		try {
			const req = await dispense.requestEmergencyStock({
				prescription_id: selectedPrescription.id,
				to_warehouse_id: selectedPrescription.warehouse_id,
				from_warehouse_id: mainWarehouse?.id,
				notes: requestNotes,
				items: requestItems.map((i) => ({
					product_id: i.product_id,
					requested_qty: Number(i.requested_qty) || 0
				}))
			});
			showNotification(
				'success',
				`Amprahan darurat ${req.no_trx} berhasil diajukan ke ${mainWarehouse?.name ?? 'Gudang Utama'}.`
			);
			isRequestModalOpen = false;
		} catch (err: any) {
			showNotification('error', err.message || 'Gagal mengajukan amprahan darurat');
		}
	}

	/* ------------------------------ Helpers ---------------------------- */
	function priorityMeta(priority: string): { label: string; badge: string; dot: string } {
		switch (priority) {
			case 'EMERGENCY':
				return {
					label: PRESCRIPTION_PRIORITY_LABELS.EMERGENCY,
					badge: 'bg-rose-100 text-rose-800 border-rose-200',
					dot: 'bg-rose-500'
				};
			case 'URGENT':
				return {
					label: PRESCRIPTION_PRIORITY_LABELS.URGENT,
					badge: 'bg-amber-100 text-amber-800 border-amber-200',
					dot: 'bg-amber-500'
				};
			default:
				return {
					label: PRESCRIPTION_PRIORITY_LABELS.NORMAL,
					badge: 'bg-slate-100 text-slate-700 border-slate-200',
					dot: 'bg-slate-400'
				};
		}
	}

	function formatTime(dateStr?: string): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	function formatDateTime(dateStr?: string): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Title title="Apoteker | Antrean & Validasi Resep" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<aside
			class="hidden w-64 shrink-0 border-r border-slate-100 bg-white lg:block"
			aria-hidden="true"
		></aside>
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="apoteker"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={handleMenuSelect}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex h-full flex-1 flex-col overflow-hidden">
		{#if !isForbidden}
			<header
				class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden"
			>
				<button
					onclick={() => (isSidebarOpen = true)}
					class="text-amber-700 focus:outline-none"
					aria-label="Buka Menu Sidebar"
				>
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
					class="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"
				>
					ID: {currentUser.user_code || currentUser.id}
				</div>
			</header>
		{/if}

		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10' : ''}>
			{#if isLoading}
				<div class="flex h-full items-center justify-center">
					<div class="flex flex-col items-center gap-3 text-slate-400">
						<span class="inline-block animate-spin text-3xl">🌀</span>
						<p class="text-sm font-bold">Memuat dashboard farmasi...</p>
					</div>
				</div>
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- NOTIFICATION TOAST -->
				{#if notification}
					<div
						class={`fixed top-6 right-6 z-[70] flex max-w-md items-start gap-3 rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
							notification.type === 'success'
								? 'border border-emerald-300 bg-emerald-900 text-white'
								: 'border border-rose-300 bg-rose-900 text-white'
						}`}
						role="alert"
					>
						<span class="text-xl">{notification.type === 'success' ? '✅' : '⚠️'}</span>
						<p class="text-sm font-semibold leading-snug">{notification.message}</p>
						<button
							onclick={() => (notification = null)}
							class="ml-1 font-bold text-white/70 hover:text-white"
							aria-label="Tutup Notifikasi"
						>
							✕
						</button>
					</div>
				{/if}

				<!-- ============================================================ -->
				<!-- HERO + KONTEKS DEPO AKTIF                                    -->
				<!-- ============================================================ -->
				<div
					class="relative mb-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 p-6 text-white shadow-xl sm:p-8"
				>
					<div class="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl"></div>

					<div
						class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
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
								<p class="text-[11px] font-bold tracking-widest text-amber-300 uppercase">
									Antrean &amp; Validasi Resep
								</p>
							</div>
							<h1 class="text-3xl font-black tracking-tight sm:text-4xl">
								Halo, {currentUser.name}! 💊
							</h1>
							<p class="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
								Ada <strong class="font-bold text-amber-300">{stats.pending} resep</strong> menunggu
								ditebus, dan
								<strong class="font-bold text-rose-400">{stats.shortage} resep</strong> terdeteksi
								stok depo kurang.
							</p>
							<span
								class="mt-3 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold tracking-wider text-amber-200 uppercase"
							>
								🔧 Mode Dummy — data fitur contoh
							</span>
						</div>

						<!-- Selector Depo Farmasi Aktif -->
						<div class="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
							<label
								for="active-warehouse"
								class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-amber-200 uppercase"
							>
								<span>🏥</span> Depo Farmasi Aktif
							</label>
							<select
								id="active-warehouse"
								value={dispense.activeWarehouseId}
								onchange={handleWarehouseChange}
								class="mt-2 w-full rounded-xl border border-white/20 bg-slate-900/60 px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40"
							>
								{#each depoWarehouses as wh (wh.id)}
									<option value={wh.id}>
										{wh.name} ({WAREHOUSE_TYPE_LABELS[wh.type]})
									</option>
								{/each}
							</select>
							<p class="mt-2 text-[11px] text-slate-300">
								Kode: <span class="font-mono font-bold text-amber-200">{activeWarehouse?.code ?? '-'}</span>
								{#if mainWarehouse}
									• Sumber amprahan:
									<span class="font-semibold text-emerald-300">{mainWarehouse.name}</span>
								{/if}
							</p>
						</div>
					</div>
				</div>

				<!-- ============================================================ -->
				<!-- STAT CARDS                                                   -->
				<!-- ============================================================ -->
				<section class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<button
						onclick={() => (priorityFilter = 'ALL')}
						class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${
							priorityFilter === 'ALL'
								? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300'
								: 'border-amber-200 bg-white'
						}`}
					>
						<div class="flex items-center justify-between">
							<p class="text-xs font-bold tracking-wider text-amber-800 uppercase">Antrean Resep</p>
							<span class="rounded-lg bg-amber-100 p-2 text-amber-700">⏳</span>
						</div>
						<p class="mt-3 text-3xl font-black text-amber-700">{stats.pending}</p>
						<span class="mt-1 block text-[10px] font-bold text-amber-600 uppercase">
							Menunggu validasi
						</span>
					</button>

					<button
						onclick={() =>
							(priorityFilter = priorityFilter === 'URGENT' ? 'ALL' : 'URGENT')}
						class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${
							priorityFilter === 'URGENT'
								? 'border-rose-500 bg-rose-50 ring-2 ring-rose-300'
								: 'border-rose-200 bg-white'
						}`}
					>
						<div class="flex items-center justify-between">
							<p class="text-xs font-bold tracking-wider text-rose-800 uppercase">Prioritas Tinggi</p>
							<span class="rounded-lg bg-rose-100 p-2 text-rose-700">🚨</span>
						</div>
						<p class="mt-3 text-3xl font-black text-rose-700">{stats.urgent}</p>
						<span class="mt-1 block text-[10px] font-bold text-rose-600 uppercase">
							Urgent / Darurat
						</span>
					</button>

					<div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
						<div class="flex items-center justify-between">
							<p class="text-xs font-bold tracking-wider text-emerald-800 uppercase">
								Siap Ditebus
							</p>
							<span class="rounded-lg bg-emerald-100 p-2 text-emerald-700">✅</span>
						</div>
						<p class="mt-3 text-3xl font-black text-emerald-700">{stats.ready}</p>
						<span class="mt-1 block text-[10px] font-bold text-emerald-600 uppercase">
							Stok depo mencukupi
						</span>
					</div>

					<div class="rounded-2xl border border-rose-300 bg-rose-50 p-5 shadow-sm">
						<div class="flex items-center justify-between">
							<p class="text-xs font-bold tracking-wider text-rose-800 uppercase">Stok Kurang</p>
							<span class="animate-bounce rounded-lg bg-rose-200 p-2 text-rose-800">⚠️</span>
						</div>
						<p class="mt-3 text-3xl font-black text-rose-700">{stats.shortage}</p>
						<span class="mt-1 block text-[10px] font-bold text-rose-600 uppercase">
							Perlu amprahan
						</span>
					</div>
				</section>

				<!-- ============================================================ -->
				<!-- TOOLBAR                                                      -->
				<!-- ============================================================ -->
				<div
					class="mb-6 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
				>
					<div class="relative w-full sm:w-96">
						<svg
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="11" cy="11" r="7" />
							<path d="m20 20-3.5-3.5" />
						</svg>
						<input
							bind:value={searchQuery}
							class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pr-3 pl-9 text-xs transition outline-none placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
							placeholder="Cari nama pasien, No. TRX, RM, atau dokter..."
						/>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
							{#each [['ALL', 'Semua'], ['NORMAL', 'Normal'], ['URGENT', 'Urgent'], ['EMERGENCY', 'Darurat']] as [value, label] (value)}
								<button
									onclick={() => (priorityFilter = value as typeof priorityFilter)}
									class={`rounded-[10px] px-3 py-1.5 text-[11px] font-bold transition ${
										priorityFilter === value
											? 'bg-white text-slate-900 shadow-sm'
											: 'text-slate-500 hover:text-slate-700'
									}`}
								>
									{label}
								</button>
							{/each}
						</div>

						<button
							onclick={handleRefresh}
							disabled={dispense.isLoading}
							class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span class={dispense.isLoading ? 'inline-block animate-spin' : 'inline-block'}>🔄</span>
							{dispense.isLoading ? 'Memuat...' : 'Refresh'}
						</button>
					</div>
				</div>

				<!-- ============================================================ -->
				<!-- 2-COLUMN: ANTREAN RESEP + SIDEBAR STOK                       -->
				<!-- ============================================================ -->
				<div class="grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
					<!-- KIRI: DAFTAR ANTREAN RESEP -->
					<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
						<div
							class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Antrean Resep Masuk</h2>
								<p class="text-xs text-slate-500">
									{activeWarehouse?.name ?? 'Depo'} • {filteredQueue.length} dari {queue.length} resep
								</p>
							</div>
						</div>

						{#if dispense.isLoading}
							<div class="space-y-4">
								{#each Array(3)}
									<div
										class="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-5"
									>
										<div class="h-4 w-1/3 rounded-full bg-slate-200"></div>
										<div class="mt-3 h-3 w-1/2 rounded-full bg-slate-100"></div>
										<div class="mt-4 h-8 w-full rounded-lg bg-slate-100"></div>
									</div>
								{/each}
							</div>
						{:else if filteredQueue.length === 0}
							<div class="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
								<p class="text-4xl">🎉</p>
								<p class="mt-2 text-base font-bold text-slate-700">Tidak ada resep di antrean</p>
								<p class="mx-auto mt-1 max-w-sm text-xs text-slate-400">
									Semua resep untuk {activeWarehouse?.name ?? 'depo ini'} telah divalidasi atau tidak
									ada yang cocok dengan filter.
								</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each filteredQueue as p (p.id)}
									{@const pm = priorityMeta(p.priority)}
									<div
										class={`rounded-2xl border bg-slate-50 p-5 shadow-sm transition hover:bg-white hover:shadow-md ${
											p.has_shortage ? 'border-rose-300' : 'border-slate-200'
										}`}
									>
										<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center gap-2">
													<span
														class={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-black uppercase ${pm.badge}`}
													>
														<span class={`h-1.5 w-1.5 rounded-full ${pm.dot}`}></span>
														{pm.label}
													</span>
													<p class="text-lg font-black text-slate-900">{p.patient_name}</p>
													{#if p.has_shortage}
														<span
															class="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black tracking-wider text-white uppercase"
														>
															Stok Kurang
														</span>
													{:else}
														<span
															class="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-800 uppercase"
														>
															Siap Ditebus
														</span>
													{/if}
												</div>

												<p class="mt-1.5 text-xs text-slate-500">
													No. TRX: <strong class="text-slate-700">{p.no_trx}</strong>
													• RM: <strong class="text-slate-700">{p.medical_record_number}</strong>
													• Dokter: <strong class="text-slate-700">{p.doctor_name}</strong>
													• Masuk: <strong class="text-slate-700">{formatTime(p.recipe_date)}</strong>
												</p>

												<!-- Item obat + indikator stok -->
												<div class="mt-3 flex flex-wrap gap-2">
													{#each p.items as item (item.id)}
														<span
															class={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
																item.available
																	? 'border-slate-200 bg-white text-slate-700'
																	: 'border-rose-300 bg-rose-50 text-rose-800'
															}`}
														>
															💊 {item.product_name}
															<span class="text-slate-400">•</span>
															<span>Diminta {item.quantity} {item.unit}</span>
															<span
																class={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
																	item.available
																		? 'bg-emerald-100 text-emerald-800'
																		: 'bg-rose-600 text-white'
																}`}
															>
																Stok: {item.stock_in_warehouse}
																{item.available ? '' : ` (kurang ${item.shortfall})`}
															</span>
														</span>
													{/each}
												</div>
											</div>

											<div class="flex shrink-0 flex-col items-stretch gap-2 lg:w-44">
												<button
													onclick={() => openValidationModal(p)}
													class="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-amber-700 focus:ring-2 focus:ring-amber-400"
												>
													Validasi / Serahkan
												</button>
												{#if p.has_shortage}
													<button
														onclick={() => {
															selectedPrescriptionId = p.id;
															openRequestModal();
														}}
														class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
													>
														📦 Amprahan Darurat
													</button>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<!-- KANAN: STOK KRITIS + AMPRAHAN -->
					<aside class="space-y-6">
						<!-- STOK KRITIS DI DEPO -->
						<div class="rounded-[24px] border border-rose-200 bg-white p-5 shadow-sm sm:p-6">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="flex items-center gap-2 text-base font-bold text-slate-900">
									<span>⚠️</span> Stok Kritis Depo ({lowStockProducts.length})
								</h3>
							</div>

							<div class="max-h-72 space-y-3 overflow-y-auto">
								{#each lowStockProducts as row (row.product.id)}
									<div
										class="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3"
									>
										<div class="min-w-0">
											<p class="truncate text-xs font-bold text-slate-900">
												{row.product.name}
											</p>
											<p class="text-[10px] font-semibold text-rose-700">
												Min. {row.min_stock} {row.product.unit} • Kurang {row.deficit}
											</p>
										</div>
										<span
											class={`shrink-0 rounded px-2 py-1 text-xs font-bold text-white ${
												row.stock <= 0 ? 'bg-rose-700' : 'bg-rose-500'
											}`}
										>
											{row.stock} {row.product.unit}
										</span>
									</div>
								{:else}
									<p class="py-4 text-center text-xs text-slate-400">
										Semua stok produk aman di atas batas minimum.
									</p>
								{/each}
							</div>
						</div>

						<!-- AMPRAHAN DARURAT DIAJUKAN -->
						<div class="rounded-[24px] bg-slate-900 p-5 text-white shadow-lg sm:p-6">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="text-lg font-bold">Amprahan Darurat</h3>
									<p class="text-xs text-slate-400">Permohonan transfer stok ke Gudang Utama</p>
								</div>
								<span class="text-2xl">📦</span>
							</div>

							<div class="mt-5 space-y-3">
								{#each pendingRequests as req (req.id)}
									<div class="rounded-xl border border-white/10 bg-white/10 p-3">
										<div class="flex items-center justify-between">
											<p class="font-mono text-xs font-bold text-amber-300">{req.no_trx}</p>
											<span
												class="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-white"
											>
												{req.priority}
											</span>
										</div>
										<p class="mt-1 text-[11px] text-slate-300">
											{req.items.length} item •
											{formatDateTime(req.requested_at)}
										</p>
										<p class="mt-0.5 truncate text-[10px] text-slate-400">
											{dispense.warehouseById(req.from_warehouse_id)?.name ?? 'Gudang'} →
											{dispense.warehouseById(req.to_warehouse_id)?.name ?? 'Depo'}
										</p>
									</div>
								{:else}
									<p class="py-6 text-center text-xs text-slate-500">
										Belum ada amprahan darurat diajukan.
									</p>
								{/each}
							</div>
						</div>
					</aside>
				</div>
			{/if}
		</div>
	</main>
</div>

<!-- ============================================================ -->
<!-- MODAL: VALIDASI & SERAHKAN OBAT                              -->
<!-- ============================================================ -->
{#if isValidationModalOpen && selectedPrescription}
	<div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
		<button
			onclick={closeValidationModal}
			class="absolute inset-0 h-full w-full cursor-default bg-slate-900/60 backdrop-blur-sm"
			aria-label="Tutup Modal Validasi Resep"
		></button>

		<div
			class="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
			role="dialog"
			aria-modal="true"
			aria-label={`Validasi resep ${selectedPrescription.no_trx}`}
		>
			<!-- Header -->
			<div class="border-b border-slate-100 pb-4">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-black uppercase ${selectedPriorityMeta.badge}`}
					>
						<span class={`h-1.5 w-1.5 rounded-full ${selectedPriorityMeta.dot}`}></span>
						{selectedPriorityMeta.label}
					</span>
					<span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-800 uppercase">
						Validasi Resep
					</span>
				</div>
				<h3 class="mt-2 text-2xl font-black text-slate-900">
					{selectedPrescription.patient_name}
				</h3>
				<p class="mt-1 text-xs text-slate-500">
					No. TRX: <strong class="text-slate-700">{selectedPrescription.no_trx}</strong>
					• RM: <strong class="text-slate-700">{selectedPrescription.medical_record_number}</strong>
					• Dokter: <strong class="text-slate-700">{selectedPrescription.doctor_name}</strong>
				</p>
				<p class="mt-1 text-[11px] text-slate-500">
					Depo penyerahan:
					<strong class="text-slate-700">
						{dispense.warehouseById(selectedPrescription.warehouse_id)?.name ?? '-'}
					</strong>
				</p>
				{#if selectedPrescription.notes}
					<p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] italic text-slate-600">
						Catatan dokter: {selectedPrescription.notes}
					</p>
				{/if}
			</div>

			<!-- Tabel item + cek stok -->
			<div class="mt-5">
				<p class="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
					Cek Stok Real-time di Depo ({selectedPrescription.total_ready}/
					{selectedPrescription.total_items} item siap)
				</p>
				<div class="overflow-hidden rounded-xl border border-slate-200">
					<table class="w-full border-collapse text-left text-xs">
						<thead class="bg-slate-50">
							<tr class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
								<th class="px-3 py-2.5">Obat</th>
								<th class="px-3 py-2.5">Aturan Pakai</th>
								<th class="px-3 py-2.5 text-center">Diminta</th>
								<th class="px-3 py-2.5 text-center">Stok Depo</th>
								<th class="px-3 py-2.5 text-center">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each selectedPrescription.items as item (item.id)}
								<tr class={item.available ? '' : 'bg-rose-50/60'}>
									<td class="px-3 py-3">
										<p class="font-bold text-slate-900">{item.product_name}</p>
										<p class="font-mono text-[10px] text-slate-400">{item.product_code}</p>
									</td>
									<td class="px-3 py-3 text-slate-600">{item.rules_using}</td>
									<td class="px-3 py-3 text-center font-bold text-slate-800">
										{item.quantity} {item.unit}
									</td>
									<td class="px-3 py-3 text-center font-bold">
										<span class={item.available ? 'text-emerald-700' : 'text-rose-700'}>
											{item.stock_in_warehouse} {item.unit}
										</span>
									</td>
									<td class="px-3 py-3 text-center">
										{#if item.available}
											<span class="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
												Siap
											</span>
										{:else}
											<span class="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white">
												Kurang {item.shortfall}
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Peringatan stok tidak cukup + quick action -->
			{#if selectedPrescription.has_shortage}
				<div class="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4">
					<div class="flex items-start gap-3">
						<span class="text-xl">🚫</span>
						<div class="flex-1">
							<p class="text-sm font-bold text-rose-800">Stok tidak mencukupi di depo ini</p>
							<p class="mt-0.5 text-[11px] text-rose-700">
								Penyerahan obat akan ditolak hingga stok tersedia. Ajukan permohonan
								amprahan/transfer darurat ke
								<strong>{mainWarehouse?.name ?? 'Gudang Utama'}</strong>.
							</p>
							<button
								onclick={openRequestModal}
								class="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-rose-700"
							>
								⚡ Amprahan Darurat ke Gudang Utama
							</button>
						</div>
					</div>
				</div>
			{:else}
				<div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
					<div class="flex items-center gap-3">
						<span class="text-xl">✅</span>
						<p class="text-[11px] font-semibold text-emerald-800">
							Semua item resep tersedia di depo. Sistem akan mencatat log <strong>DISPENSE</strong>
							dan memotong stok secara otomatis saat divalidasi.
						</p>
					</div>
				</div>
			{/if}

			<!-- Catatan verifikasi -->
			<div class="mt-4">
				<label for="verify-notes" class="mb-1 block font-bold text-slate-700 text-xs">
					Catatan Verifikasi Apoteker
				</label>
				<textarea
					id="verify-notes"
					bind:value={verifyNotes}
					rows="2"
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-amber-500 focus:bg-white"
				></textarea>
			</div>

			<!-- Footer -->
			<div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
				<button
					onclick={closeValidationModal}
					class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
				>
					Batal
				</button>
				<button
					onclick={handleValidate}
					disabled={dispense.isDispensing}
					class="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
				>
					{dispense.isDispensing ? 'Memproses Stok...' : '✅ Validasi & Serahkan Obat'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ============================================================ -->
<!-- MODAL: AMPRAHAN DARURAT KE GUDANG UTAMA                      -->
<!-- ============================================================ -->
{#if isRequestModalOpen && selectedPrescription}
	<div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
		<button
			onclick={() => (isRequestModalOpen = false)}
			class="absolute inset-0 h-full w-full cursor-default bg-slate-900/60 backdrop-blur-sm"
			aria-label="Tutup Modal Amprahan Darurat"
		></button>

		<div
			class="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"
			role="dialog"
			aria-modal="true"
			aria-label="Amprahan darurat"
		>
			<div class="border-b border-slate-100 pb-3">
				<span class="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-rose-800 uppercase">
					Amprahan Darurat
				</span>
				<h3 class="mt-2 text-xl font-black text-slate-900">Permohonan Transfer Stok</h3>
				<p class="mt-1 text-xs text-slate-500">
					Dari
					<strong class="text-emerald-700">{mainWarehouse?.name ?? 'Gudang Utama'}</strong>
					ke
					<strong class="text-slate-800">
						{dispense.warehouseById(selectedPrescription.warehouse_id)?.name ?? 'Depo'}
					</strong>
				</p>
			</div>

			<div class="mt-4 space-y-3">
				{#each requestItems as item (item.product_id)}
					<div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-xs font-bold text-slate-900">{item.product_name}</p>
								<p class="text-[10px] text-rose-600 font-semibold">
									Kurang {item.shortfall} {item.unit} di depo
								</p>
							</div>
							<div class="w-28 shrink-0">
								<label
									for={`req-qty-${item.product_id}`}
									class="block text-[10px] font-bold text-slate-500 uppercase"
								>
									Jumlah ({item.unit})
								</label>
								<input
									id={`req-qty-${item.product_id}`}
									type="number"
									min="1"
									bind:value={item.requested_qty}
									class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold outline-none focus:border-amber-500"
								/>
							</div>
						</div>
					</div>
				{/each}

				<div>
					<label for="request-notes" class="mb-1 block font-bold text-slate-700 text-xs">
						Catatan Permohonan
					</label>
					<textarea
						id="request-notes"
						bind:value={requestNotes}
						rows="2"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-amber-500 focus:bg-white"
					></textarea>
				</div>

				<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
					💡 Permohonan akan masuk ke antrean <strong>Penerimaan/Distribusi Logistik</strong>
					sebagai prioritas <strong>URGENT</strong>.
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
				<button
					onclick={() => (isRequestModalOpen = false)}
					class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
				>
					Batal
				</button>
				<button
					onclick={handleSubmitRequest}
					disabled={dispense.isSubmittingRequest}
					class="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-rose-700 disabled:opacity-50"
				>
					{dispense.isSubmittingRequest ? 'Mengirim...' : '⚡ Kirim Amprahan Darurat'}
				</button>
			</div>
		</div>
	</div>
{/if}
