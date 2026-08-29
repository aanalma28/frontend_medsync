<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonApoteker from '$lib/components/skeleton/DashboardSkeletonApoteker.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import {
		productStore,
		type Product,
		type PendingPrescription,
		type ProductCategory
	} from '$lib/stores/product.svelte';
	import { userStore } from '$lib/stores/user.svelte';

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<{ role: string; name: string; id: string; user_code?: string }>({
		role: 'apoteker',
		name: '',
		id: '',
		user_code: ''
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// Notification State
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	function showNotification(type: 'success' | 'error', message: string) {
		notification = { type, message };
		setTimeout(() => {
			notification = null;
		}, 5000);
	}

	// Product Catalog Filters & State
	let productSearchQuery = $state('');
	let selectedCategoryFilter = $state<string>('ALL');
	let filterLowStockOnly = $state(false);

	// Modal States
	let isAddProductModalOpen = $state(false);
	let isRestockModalOpen = $state(false);
	let isDispenseModalOpen = $state(false);

	let selectedProductForRestock = $state<Product | null>(null);
	let selectedPrescriptionForDispense = $state<PendingPrescription | null>(null);

	// Form States: Add Product
	let newProductForm = $state<{
		code: string;
		name: string;
		category: ProductCategory;
		unit: string;
		stock: number;
		min_stock: number;
		buy_price: number;
		sell_price: number;
		description: string;
	}>({
		code: '',
		name: '',
		category: 'DRUG',
		unit: 'Strip',
		stock: 10,
		min_stock: 5,
		buy_price: 5000,
		sell_price: 8000,
		description: ''
	});

	// Form States: Restock
	let restockForm = $state<{
		quantity: number;
		buy_price: number;
		exp_date: string;
		supplierName: string;
		reference_number: string;
		notes: string;
	}>({
		quantity: 10,
		buy_price: 0,
		exp_date: '',
		supplierName: 'PT Medika Farma Utama',
		reference_number: '',
		notes: ''
	});

	// Form States: Dispense
	let dispenseVerifyNotes = $state('Resep terverifikasi dan sesuai dosis');

	// Pickup Queue State
	let pickupQueue = $state<{ patient: string; medicine: string; time: string }[]>([]);

	onMount(async () => {
		try {
			const profile = await validateSession();

			const roleLower = profile.role.toLowerCase();
			if (roleLower !== 'pharmacist' && roleLower !== 'superadmin' && roleLower !== 'masteradmin') {
				isForbidden = true;
			} else {
				currentUser = profile;
				// Load backend data
				await Promise.all([
					productStore.fetchProducts(),
					productStore.fetchPendingPrescriptions(),
					userStore.fetchUsers({ role: 'pasien' })
				]);
			}
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});

	// Derived values for Products
	let filteredProducts = $derived(
		productStore.products.filter((p) => {
			const matchSearch =
				p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
				p.code.toLowerCase().includes(productSearchQuery.toLowerCase());

			const matchCat =
				selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter;

			const matchLowStock = filterLowStockOnly ? p.is_low_stock : true;

			return matchSearch && matchCat && matchLowStock;
		})
	);

	let lowStockProducts = $derived(productStore.products.filter((p) => p.is_low_stock));
	let nearExpiryProducts = $derived(productStore.products.filter((p) => p.is_near_expiry));
	let totalPhysicalStock = $derived(
		productStore.products.reduce((acc, curr) => acc + (curr.stock || 0), 0)
	);
	let distinctCategoryCount = $derived(
		new Set(productStore.products.map((p) => p.category)).size
	);

	// Recipe status counts & derived values
	let pendingPrescriptionsList = $derived(productStore.pendingPrescriptions);

	let countPendingRecipes = $derived(
		pendingPrescriptionsList.filter((p) => !p.status || p.status === 'PENDING').length
	);
	let countConfirmedRecipes = $derived(
		pendingPrescriptionsList.filter((p) => p.status === 'CONFIRMED').length
	);
	let countCompletedRecipes = $derived(
		pendingPrescriptionsList.filter((p) => p.status === 'COMPLETED').length
	);
	let countCancelledRecipes = $derived(
		pendingPrescriptionsList.filter((p) => p.status === 'CANCELLED').length
	);

	// Filter prescription by status or search
	let prescriptionSearchQuery = $state('');
	let selectedRecipeStatusFilter = $state<string>('ALL');

	let filteredPrescriptions = $derived(
		pendingPrescriptionsList.filter((p) => {
			const status = p.status || 'PENDING';
			const matchStatus =
				selectedRecipeStatusFilter === 'ALL' || status === selectedRecipeStatusFilter;

			const matchSearch =
				p.patient_name.toLowerCase().includes(prescriptionSearchQuery.toLowerCase()) ||
				p.doctor_name.toLowerCase().includes(prescriptionSearchQuery.toLowerCase()) ||
				p.no_trx.toLowerCase().includes(prescriptionSearchQuery.toLowerCase()) ||
				p.items.some((i) => i.product_name.toLowerCase().includes(prescriptionSearchQuery.toLowerCase()));

			return matchStatus && matchSearch;
		})
	);

	let urgentPrescription = $derived(
		pendingPrescriptionsList.length > 0 ? pendingPrescriptionsList[0] : null
	);

	// Patient directory derived (using userStore.list)
	let userSearchQuery = $state('');
	let filteredPatients = $derived(
		userStore.list.filter((u) => {
			const isPatientRole = u.role === 'pasien' || u.role === 'PATIENT';
			const search = userSearchQuery.toLowerCase();
			const matchQuery =
				u.name.toLowerCase().includes(search) ||
				u.email.toLowerCase().includes(search) ||
				(u.phone && u.phone.toLowerCase().includes(search)) ||
				(u.displayId && u.displayId.toLowerCase().includes(search));
			return isPatientRole && matchQuery;
		})
	);

	// Indonesian Status Helper for Recipes
	function getRecipeStatusLabel(statusStr?: string): { label: string; class: string } {
		switch (statusStr) {
			case 'CONFIRMED':
				return { label: 'Diproses / Dikonfirmasi', class: 'bg-blue-100 text-blue-800 border-blue-200' };
			case 'COMPLETED':
				return { label: 'Selesai / Ditebus', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
			case 'CANCELLED':
				return { label: 'Dibatalkan', class: 'bg-rose-100 text-rose-800 border-rose-200' };
			case 'PENDING':
			default:
				return { label: 'Menunggu Ditebus', class: 'bg-amber-100 text-amber-800 border-amber-200' };
		}
	}

	// Category label helper
	function getCategoryLabel(cat: string): string {
		switch (cat) {
			case 'DRUG':
				return 'Obat (Resep/Bebas)';
			case 'CONSUMABLE':
				return 'Bahan Habis Pakai';
			case 'SUPPLEMENT':
				return 'Suplemen & Vitamin';
			case 'MEDICAL_DEVICE':
				return 'Alat Medis';
			default:
				return 'Lainnya';
		}
	}

	function getCategoryBadgeClass(cat: string): string {
		switch (cat) {
			case 'DRUG':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'CONSUMABLE':
				return 'bg-amber-100 text-amber-800 border-amber-200';
			case 'SUPPLEMENT':
				return 'bg-emerald-100 text-emerald-800 border-emerald-200';
			case 'MEDICAL_DEVICE':
				return 'bg-purple-100 text-purple-800 border-purple-200';
			default:
				return 'bg-slate-100 text-slate-800 border-slate-200';
		}
	}

	function formatRupiah(amount: number): string {
		return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
	}

	function formatDate(dateStr?: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// Action handlers
	async function handleAddProduct() {
		try {
			await productStore.createProduct(newProductForm);
			showNotification('success', `Produk "${newProductForm.name}" berhasil ditambahkan.`);
			isAddProductModalOpen = false;
			// Reset form
			newProductForm = {
				code: '',
				name: '',
				category: 'DRUG',
				unit: 'Strip',
				stock: 10,
				min_stock: 5,
				buy_price: 5000,
				sell_price: 8000,
				description: ''
			};
		} catch (err: any) {
			showNotification('error', err.message || 'Gagal menambahkan produk');
		}
	}

	function openRestockModal(product: Product) {
		selectedProductForRestock = product;
		restockForm = {
			quantity: 10,
			buy_price: product.buy_price,
			exp_date: '',
			supplierName: 'PT Medika Farma Utama',
			reference_number: `RESTOCK-${Date.now().toString().slice(-5)}`,
			notes: 'Penambahan stok masuk'
		};
		isRestockModalOpen = true;
	}

	async function handleRestock() {
		if (!selectedProductForRestock) return;
		try {
			await productStore.restockProduct(selectedProductForRestock.id, restockForm);
			showNotification(
				'success',
				`Berhasil menambahkan stok ${restockForm.quantity} ${selectedProductForRestock.unit} untuk ${selectedProductForRestock.name}.`
			);
			isRestockModalOpen = false;
			selectedProductForRestock = null;
		} catch (err: any) {
			showNotification('error', err.message || 'Gagal restock produk');
		}
	}

	function openDispenseModal(prescription: PendingPrescription) {
		selectedPrescriptionForDispense = prescription;
		dispenseVerifyNotes = 'Resep terverifikasi oleh Apoteker dan dosis sesuai';
		isDispenseModalOpen = true;
	}

	async function handleDispense() {
		if (!selectedPrescriptionForDispense) return;
		try {
			await productStore.dispensePrescription(
				selectedPrescriptionForDispense.id,
				dispenseVerifyNotes
			);
			showNotification(
				'success',
				`Resep No. ${selectedPrescriptionForDispense.no_trx} atas nama ${selectedPrescriptionForDispense.patient_name} berhasil ditebus & stok otomatis dipotong!`
			);

			// Add to pickup queue
			pickupQueue = [
				{
					patient: selectedPrescriptionForDispense.patient_name,
					medicine: selectedPrescriptionForDispense.items.map((i) => i.product_name).join(', '),
					time: 'Baru Saja Siap'
				},
				...pickupQueue
			];

			isDispenseModalOpen = false;
			selectedPrescriptionForDispense = null;
		} catch (err: any) {
			showNotification('error', err.message || 'Gagal menebus resep');
		}
	}
</script>

<Title title="Apoteker | Dashboard Utama Farmasi" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="apoteker"
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
				<DashboardSkeletonApoteker />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- NOTIFICATION TOAST -->
				{#if notification}
					<div
						class={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl p-4 shadow-2xl transition-all duration-300 ${notification.type === 'success' ? 'border border-emerald-300 bg-emerald-900 text-white' : 'border border-rose-300 bg-rose-900 text-white'}`}
					>
						<span class="text-xl">{notification.type === 'success' ? '✅' : '⚠️'}</span>
						<p class="text-sm font-semibold">{notification.message}</p>
						<button
							onclick={() => (notification = null)}
							class="ml-3 font-bold text-white/70 hover:text-white"
							aria-label="Tutup Notifikasi"
						>
							✕
						</button>
					</div>
				{/if}

				<!-- ============================================= -->
				<!-- DASHBOARD UTAMA (MENU: beranda)              -->
				<!-- FOKUS: STATUS RESEP & ALERT STOK MENIPIS     -->
				<!-- ============================================= -->
				{#if activeMenu === 'beranda'}
					<!-- HEADER HERO APOTEKER -->
					<div
						class="relative mb-8 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 p-6 text-white shadow-xl sm:p-8"
					>
						<div
							class="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl"
						></div>
						<div class="absolute right-5 bottom-0 opacity-10">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-36 w-36"
							>
								<path
									d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-.46-.46V20.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-7.06l-.46.46a.75.75 0 11-1.06-1.06l8.99-9zM12 7.5a.75.75 0 00-.75.75v1.5H9.75a.75.75 0 000 1.5h1.5v1.5a.75.75 0 001.5 0v-1.5h1.5a.75.75 0 000-1.5h-1.5v-1.5A.75.75 0 0012 7.5z"
								/>
							</svg>
						</div>

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
									<p class="text-[11px] font-bold tracking-widest text-amber-300 uppercase">
										Dashboard Utama Handling Resep
									</p>
								</div>
								<h1 class="text-3xl font-black tracking-tight sm:text-4xl">
									Halo, {currentUser.name}! 💊
								</h1>
								<p class="mt-2 text-sm text-slate-300 sm:text-base">
									Ada <strong class="text-amber-300 font-bold">{countPendingRecipes} resep</strong>
									menunggu ditebus, dan
									<strong class="text-rose-400 font-bold">{lowStockProducts.length} produk stok menipis</strong>.
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-3">
								<button
									onclick={() => (activeMenu = 'inventory')}
									class="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-bold text-amber-300 hover:bg-white/20 backdrop-blur-md transition"
								>
									📦 Manajemen Stok Selengkapnya ➔
								</button>
							</div>
						</div>
					</div>

					<!-- CARDS STATUS RESEP (PENDING, CONFIRMED, COMPLETED, CANCELLED) + 1 ALERT STOK MENIPIS -->
					<section class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
						<!-- CARD 1: PENDING (Menunggu Ditebus) -->
						<button
							onclick={() => (selectedRecipeStatusFilter = selectedRecipeStatusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
							class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${selectedRecipeStatusFilter === 'PENDING' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : 'border-amber-200 bg-white'}`}
						>
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold text-amber-800 uppercase tracking-wider">
									Menunggu Ditebus
								</p>
								<span class="rounded-lg bg-amber-100 p-2 text-amber-700">⏳</span>
							</div>
							<p class="mt-3 text-3xl font-black text-amber-700">
								{countPendingRecipes}
							</p>
							<span class="mt-1 block text-[10px] font-bold text-amber-600 uppercase">
								Status: PENDING
							</span>
						</button>

						<!-- CARD 2: CONFIRMED (Diproses / Dikonfirmasi) -->
						<button
							onclick={() => (selectedRecipeStatusFilter = selectedRecipeStatusFilter === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
							class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${selectedRecipeStatusFilter === 'CONFIRMED' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' : 'border-blue-200 bg-white'}`}
						>
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold text-blue-800 uppercase tracking-wider">
									Diproses / Dikonfirmasi
								</p>
								<span class="rounded-lg bg-blue-100 p-2 text-blue-700">🔄</span>
							</div>
							<p class="mt-3 text-3xl font-black text-blue-700">
								{countConfirmedRecipes}
							</p>
							<span class="mt-1 block text-[10px] font-bold text-blue-600 uppercase">
								Status: CONFIRMED
							</span>
						</button>

						<!-- CARD 3: COMPLETED (Selesai / Ditebus) -->
						<button
							onclick={() => (selectedRecipeStatusFilter = selectedRecipeStatusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
							class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${selectedRecipeStatusFilter === 'COMPLETED' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300' : 'border-emerald-200 bg-white'}`}
						>
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold text-emerald-800 uppercase tracking-wider">
									Selesai / Ditebus
								</p>
								<span class="rounded-lg bg-emerald-100 p-2 text-emerald-700">✅</span>
							</div>
							<p class="mt-3 text-3xl font-black text-emerald-700">
								{countCompletedRecipes}
							</p>
							<span class="mt-1 block text-[10px] font-bold text-emerald-600 uppercase">
								Status: COMPLETED
							</span>
						</button>

						<!-- CARD 4: CANCELLED (Dibatalkan) -->
						<button
							onclick={() => (selectedRecipeStatusFilter = selectedRecipeStatusFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
							class={`rounded-2xl border p-5 text-left shadow-sm transition hover:scale-[1.02] ${selectedRecipeStatusFilter === 'CANCELLED' ? 'border-slate-400 bg-slate-100 ring-2 ring-slate-300' : 'border-slate-200 bg-white'}`}
						>
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold text-slate-600 uppercase tracking-wider">
									Dibatalkan
								</p>
								<span class="rounded-lg bg-slate-200 p-2 text-slate-700">🚫</span>
							</div>
							<p class="mt-3 text-3xl font-black text-slate-700">
								{countCancelledRecipes}
							</p>
							<span class="mt-1 block text-[10px] font-bold text-slate-500 uppercase">
								Status: CANCELLED
							</span>
						</button>

						<!-- CARD 5: ALERT SINGLE CARD FOR LOW STOCK (Stok Menipis) -->
						<div class="rounded-2xl border border-rose-300 bg-rose-50 p-5 shadow-sm">
							<div class="flex items-center justify-between">
								<p class="text-xs font-bold text-rose-800 uppercase tracking-wider">
									Alert Stok Menipis
								</p>
								<span class="rounded-lg bg-rose-200 p-2 text-rose-800 animate-bounce">⚠️</span>
							</div>
							<p class="mt-3 text-3xl font-black text-rose-700">
								{lowStockProducts.length}
							</p>
							<button
								onclick={() => (activeMenu = 'inventory')}
								class="mt-1 text-[10px] font-bold text-rose-700 underline hover:text-rose-900"
							>
								Lihat Produk Menipis ➔
							</button>
						</div>
					</section>

					<!-- URGENT / PRIORITAS RESEP HERO -->
					{#if urgentPrescription}
						<section
							class="mb-8 rounded-[24px] border-2 border-rose-500 bg-gradient-to-r from-rose-50 to-amber-50 p-6 shadow-lg sm:p-8"
						>
							<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
								<div>
									<div class="mb-2 flex items-center gap-2">
										<span
											class="rounded bg-rose-600 px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase shadow-sm"
										>
											Resep Prioritas Utama
										</span>
										<span class="text-xs font-bold text-rose-700">
											No. TRX: {urgentPrescription.no_trx}
										</span>
									</div>
									<h2 class="text-2xl font-black text-slate-900">
										{urgentPrescription.patient_name}
									</h2>
									<p class="mt-1 text-sm font-medium text-slate-600">
										No. RM: <strong class="text-slate-800">{urgentPrescription.medical_record_number}</strong>
										• Dokter: <strong class="text-slate-800">{urgentPrescription.doctor_name}</strong>
									</p>
								</div>

								<div
									class="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm md:w-1/2 lg:w-5/12"
								>
									<p class="text-xs font-bold text-slate-400 uppercase tracking-wider">
										Obat yang Diresepkan ({urgentPrescription.items.length} item)
									</p>
									<ul class="mt-3 space-y-2">
										{#each urgentPrescription.items as item (item.id)}
											<li
												class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 border border-slate-200"
											>
												<div>
													<span class="text-slate-900">{item.product_name}</span>
													<span class="block text-[10px] font-normal text-slate-500">{item.rules_using}</span>
												</div>
												<span
													class={`rounded px-2 py-0.5 text-[10px] font-bold ${item.product_stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
												>
													Stok: {item.product_stock}
												</span>
											</li>
										{/each}
									</ul>

									<button
										onclick={() => openDispenseModal(urgentPrescription)}
										class="mt-4 w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-rose-700 focus:ring-2 focus:ring-rose-400"
									>
										Proses & Ditebus Sekarang
									</button>
								</div>
							</div>
						</section>
					{/if}

					<div class="grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
						<!-- LEFT: RESEP LIST WITH STATUS FILTER -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							<div
								class="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<h2 class="text-xl font-bold text-slate-900">Daftar Antrean Resep</h2>
									<p class="text-xs text-slate-500">
										Filtering berdasarkan status resep dari backend
									</p>
								</div>
								<div class="flex items-center gap-2">
									{#if selectedRecipeStatusFilter !== 'ALL'}
										<button
											onclick={() => (selectedRecipeStatusFilter = 'ALL')}
											class="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
										>
											Reset Filter Status ✕
										</button>
									{/if}
									<button
										onclick={() => productStore.fetchPendingPrescriptions()}
										class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
									>
										🔄 Refresh
									</button>
								</div>
							</div>

							<input
								bind:value={prescriptionSearchQuery}
								class="mb-6 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm transition outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
								placeholder="Cari nama pasien, nomor TRX, RM, atau nama obat..."
							/>

							{#if productStore.isLoadingPrescriptions}
								<div class="py-12 text-center text-sm font-bold text-slate-400">
									<span class="inline-block animate-spin mr-2">🌀</span> Memuat data resep...
								</div>
							{:else if filteredPrescriptions.length === 0}
								<div class="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
									<p class="text-3xl">🎉</p>
									<p class="mt-2 text-base font-bold text-slate-700">Tidak ada resep ditemukan</p>
									<p class="text-xs text-slate-400">
										Tidak ada data resep yang sesuai dengan filter pencarian atau status yang dipilih.
									</p>
								</div>
							{:else}
								<div class="space-y-4">
									{#each filteredPrescriptions as p (p.id)}
										{@const statusInfo = getRecipeStatusLabel(p.status)}
										<div
											class="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:bg-white hover:shadow-md"
										>
											<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
												<div>
													<div class="flex items-center gap-2">
														<span
															class={`rounded border px-2 py-0.5 text-[10px] font-black uppercase ${statusInfo.class}`}
														>
															{statusInfo.label}
														</span>
														<p class="font-black text-slate-900 text-lg">{p.patient_name}</p>
													</div>
													<p class="mt-1 text-xs text-slate-500">
														No. TRX: <strong>{p.no_trx}</strong> • RM:
														<strong>{p.medical_record_number}</strong> • Dokter:
														<strong>{p.doctor_name}</strong>
													</p>
													<div class="mt-3 flex flex-wrap gap-2">
														{#each p.items as item (item.id)}
															<span
																class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs"
															>
																💊 {item.product_name} ({item.rules_using})
															</span>
														{/each}
													</div>
												</div>

												<div class="flex flex-col justify-center">
													{#if !p.status || p.status === 'PENDING'}
														<button
															onclick={() => openDispenseModal(p)}
															class="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-amber-700 focus:ring-2 focus:ring-amber-400"
														>
															Verifikasi & Serahkan
														</button>
													{:else}
														<span
															class="rounded-xl bg-slate-200 px-4 py-2 text-center text-xs font-bold text-slate-700"
														>
															Status: {statusInfo.label}
														</span>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</section>

						<!-- RIGHT: LOKET & QUICK ALERT MONITORING STOK -->
						<aside class="space-y-6">
							<!-- PANGGILAN LOKET -->
							<div class="rounded-[24px] bg-slate-900 p-6 text-white shadow-lg">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="text-lg font-bold">Loket Penyerahan Obat</h3>
										<p class="text-xs text-slate-400">Panggil pasien saat obat selesai diracik</p>
									</div>
									<span class="text-2xl">📢</span>
								</div>

								<div class="mt-5 space-y-3">
									{#each pickupQueue as item (item.patient)}
										<div
											class="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 p-3"
										>
											<div>
												<p class="font-bold text-white text-sm">{item.patient}</p>
												<p class="text-[11px] text-emerald-400">{item.medicine}</p>
											</div>
											<button
												onclick={() =>
													showNotification(
														'success',
														`Memanggil pasien ${item.patient} di Loket!`
													)}
												class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-400"
											>
												Panggil
											</button>
										</div>
									{:else}
										<p class="py-6 text-center text-xs text-slate-500">Antrean loket kosong</p>
									{/each}
								</div>
							</div>

							<!-- ALERT MONITORING STOK WIDGET -->
							<div class="rounded-[24px] border border-rose-200 bg-white p-6 shadow-sm">
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
										<span>⚠️</span> Alert Stok Menipis ({lowStockProducts.length})
									</h3>
									<button
										onclick={() => (activeMenu = 'inventory')}
										class="text-xs font-bold text-amber-700 hover:underline"
									>
										Ke Manajemen Stok ➔
									</button>
								</div>

								<div class="space-y-3 max-h-72 overflow-y-auto">
									{#each lowStockProducts as item (item.id)}
										<div
											class="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3"
										>
											<div>
												<p class="text-xs font-bold text-slate-900">{item.name}</p>
												<p class="text-[10px] text-rose-700 font-semibold">
													Min Stok: {item.min_stock} {item.unit}
												</p>
											</div>
											<div class="flex items-center gap-2">
												<span class="rounded bg-rose-600 px-2 py-1 text-xs font-bold text-white">
													{item.stock} {item.unit}
												</span>
												<button
													onclick={() => openRestockModal(item)}
													class="rounded-lg border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
												>
													Restock
												</button>
											</div>
										</div>
									{:else}
										<p class="py-4 text-center text-xs text-slate-400">
											Semua stok produk aman di atas batas minimum.
										</p>
									{/each}
								</div>
							</div>
						</aside>
					</div>

					<!-- ================================================== -->
					<!-- MENU 2: MANAJEMEN STOK OBAT & PRODUK (SEPARATE)    -->
					<!-- DEDICATED FOR ALL INVENTORY & STOCK METRICS       -->
					<!-- ================================================== -->
				{:else if activeMenu === 'inventory'}
					<div class="space-y-6">
						<!-- HEADER ACTION & SUMMARY METRICS FOR STOCK -->
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between"
						>
							<div>
								<h2 class="text-2xl font-black text-slate-900">
									Manajemen Stok & Inventaris Produk
								</h2>
								<p class="mt-1 text-xs text-slate-500">
									Master data produk obat, bahan habis pakai, suplemen, serta penambahan stok (restock).
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-3">
								<button
									onclick={() => (isAddProductModalOpen = true)}
									class="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-xs font-bold text-white shadow-md transition hover:bg-amber-700 focus:ring-2 focus:ring-amber-400"
								>
									<span>➕</span> Tambah Produk Baru
								</button>
							</div>
						</div>

						<!-- STOCK METRIC CARDS (TOTAL MASTER, TOTAL FISIK, KATEGORI, NEAR EXPIRY) -->
						<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div class="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
								<div class="flex items-center justify-between">
									<p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Total Master Produk
									</p>
									<span class="rounded-lg bg-emerald-100 p-2 text-emerald-600">💊</span>
								</div>
								<p class="mt-3 text-3xl font-black text-emerald-600">
									{productStore.products.length}
								</p>
							</div>

							<div class="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
								<div class="flex items-center justify-between">
									<p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Total Stok Fisik (Unit)
									</p>
									<span class="rounded-lg bg-blue-100 p-2 text-blue-600">📦</span>
								</div>
								<p class="mt-3 text-3xl font-black text-blue-600">
									{totalPhysicalStock}
								</p>
							</div>

							<div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
								<div class="flex items-center justify-between">
									<p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Total Kategori Aktif
									</p>
									<span class="rounded-lg bg-amber-100 p-2 text-amber-600">🏷️</span>
								</div>
								<p class="mt-3 text-3xl font-black text-amber-600">
									{distinctCategoryCount}
								</p>
							</div>

							<div class="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">
								<div class="flex items-center justify-between">
									<p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
										Mendekati Expiry
									</p>
									<span class="rounded-lg bg-purple-100 p-2 text-purple-600">⏳</span>
								</div>
								<p class="mt-3 text-3xl font-black text-purple-600">
									{nearExpiryProducts.length}
								</p>
							</div>
						</section>

						<!-- FILTER PILLS & SEARCH BAR -->
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
						>
							<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div class="w-full sm:w-80">
									<input
										bind:value={productSearchQuery}
										class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs transition outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
										placeholder="Cari berdasarkan nama atau Kode SKU..."
									/>
								</div>

								<div class="flex flex-wrap items-center gap-2">
									<label
										class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl"
									>
										<input
											type="checkbox"
											bind:checked={filterLowStockOnly}
											class="accent-rose-600 rounded"
										/>
										<span>⚠️ Stok Menipis Saja ({lowStockProducts.length})</span>
									</label>
								</div>
							</div>

							<!-- CATEGORY PILLS -->
							<div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
								<button
									onclick={() => (selectedCategoryFilter = 'ALL')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${selectedCategoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
								>
									Semua Produk ({productStore.products.length})
								</button>
								<button
									onclick={() => (selectedCategoryFilter = 'DRUG')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${selectedCategoryFilter === 'DRUG' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
								>
									💊 Obat-Obatan
								</button>
								<button
									onclick={() => (selectedCategoryFilter = 'CONSUMABLE')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${selectedCategoryFilter === 'CONSUMABLE' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
								>
									🧪 Bahan Habis Pakai
								</button>
								<button
									onclick={() => (selectedCategoryFilter = 'SUPPLEMENT')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${selectedCategoryFilter === 'SUPPLEMENT' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
								>
									🌿 Suplemen & Vitamin
								</button>
								<button
									onclick={() => (selectedCategoryFilter = 'MEDICAL_DEVICE')}
									class={`rounded-xl px-4 py-2 text-xs font-bold transition ${selectedCategoryFilter === 'MEDICAL_DEVICE' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
								>
									🩺 Alat Medis
								</button>
							</div>
						</div>

						<!-- PRODUCT CATALOG TABLE -->
						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							{#if productStore.isLoadingProducts}
								<div class="py-12 text-center text-sm font-bold text-slate-400">
									<span class="inline-block animate-spin mr-2">🌀</span> Memuat katalog produk...
								</div>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full border-collapse text-left text-xs">
										<thead>
											<tr
												class="border-b border-slate-200 text-[11px] font-bold tracking-wider text-slate-400 uppercase"
											>
												<th class="px-4 pb-3">Kode / SKU</th>
												<th class="px-4 pb-3">Nama Produk</th>
												<th class="px-4 pb-3">Kategori</th>
												<th class="px-4 pb-3 text-center">Stok Saat Ini</th>
												<th class="px-4 pb-3 text-right">Harga Beli</th>
												<th class="px-4 pb-3 text-right">Harga Jual</th>
												<th class="px-4 pb-3">Status / Expired Log</th>
												<th class="px-4 pb-3 text-right">Aksi</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100 font-medium">
											{#each filteredProducts as product (product.id)}
												<tr class="transition hover:bg-slate-50/80">
													<td class="px-4 py-4 font-mono font-bold text-slate-900">
														{product.code}
													</td>
													<td class="px-4 py-4">
														<p class="font-bold text-slate-900 text-sm">{product.name}</p>
														{#if product.description}
															<p class="text-[10px] text-slate-500 line-clamp-1">
																{product.description}
															</p>
														{/if}
													</td>
													<td class="px-4 py-4">
														<span
															class={`rounded-md border px-2.5 py-1 text-[10px] font-bold ${getCategoryBadgeClass(product.category)}`}
														>
															{getCategoryLabel(product.category)}
														</span>
													</td>
													<td class="px-4 py-4 text-center">
														<div class="flex flex-col items-center">
															<span
																class={`rounded-full px-3 py-1 text-xs font-black ${product.is_low_stock ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' : 'bg-emerald-100 text-emerald-800'}`}
															>
																{product.stock} {product.unit}
															</span>
															<span class="mt-0.5 text-[9px] text-slate-400">
																Min: {product.min_stock} {product.unit}
															</span>
														</div>
													</td>
													<td class="px-4 py-4 text-right font-semibold text-slate-600">
														{formatRupiah(product.buy_price)}
													</td>
													<td class="px-4 py-4 text-right font-bold text-slate-900">
														{formatRupiah(product.sell_price)}
													</td>
													<td class="px-4 py-4">
														{#if product.is_near_expiry}
															<span
																class="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white"
															>
																⚠️ Near Expiry: {formatDate(product.nearest_exp_date)}
															</span>
														{:else if product.nearest_exp_date}
															<span class="text-[10px] font-medium text-slate-500">
																Exp: {formatDate(product.nearest_exp_date)}
															</span>
														{:else}
															<span class="text-[10px] text-slate-400">-</span>
														{/if}
													</td>
													<td class="px-4 py-4 text-right">
														<button
															onclick={() => openRestockModal(product)}
															class="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
														>
															📥 Restock
														</button>
													</td>
												</tr>
											{:else}
												<tr>
													<td colspan="8" class="py-12 text-center text-slate-400">
														Tidak ada produk inventaris yang sesuai filter.
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>

					<!-- ================================================== -->
					<!-- MENU 3: DIREKTORI PASIEN (SEPARATE VIA SIDEBAR)   -->
					<!-- ================================================== -->
				{:else if activeMenu === 'users'}
					<div class="space-y-6">
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-amber-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Direktori & Verifikasi Pasien</h2>
								<p class="mt-1 text-xs text-slate-500">
									Daftar pasien terdaftar di MedSync untuk verifikasi identitas dan resep obat.
								</p>
							</div>

							<div class="flex items-center gap-3">
								<input
									bind:value={userSearchQuery}
									class="w-full sm:w-72 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs transition outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
									placeholder="Cari nama, RM, email, atau telepon..."
								/>
								<button
									onclick={() => userStore.fetchUsers({ role: 'pasien' })}
									class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
								>
									🔄 Refresh
								</button>
							</div>
						</div>

						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							{#if userStore.isLoading}
								<div class="py-12 text-center text-sm font-bold text-slate-400">
									<span class="inline-block animate-spin mr-2">🌀</span> Memuat data pasien...
								</div>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full border-collapse text-left text-xs">
										<thead>
											<tr
												class="border-b border-slate-200 text-[11px] font-bold tracking-wider text-slate-400 uppercase"
											>
												<th class="px-4 pb-3">No. RM / ID</th>
												<th class="px-4 pb-3">Nama Pasien</th>
												<th class="px-4 pb-3">Email</th>
												<th class="px-4 pb-3">No. Telepon</th>
												<th class="px-4 pb-3">Alamat</th>
												<th class="px-4 pb-3">Status Akun</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100 font-medium">
											{#each filteredPatients as user (user.id)}
												<tr class="transition hover:bg-slate-50">
													<td class="px-4 py-4 font-mono font-bold text-amber-800">
														{user.displayId || user.patientUser?.medical_record_number || user.id.slice(-6)}
													</td>
													<td class="px-4 py-4 font-bold text-slate-900 text-sm">
														{user.name}
													</td>
													<td class="px-4 py-4 text-slate-600">{user.email}</td>
													<td class="px-4 py-4 text-slate-600">{user.phone || '-'}</td>
													<td class="px-4 py-4 text-slate-600">{user.address || '-'}</td>
													<td class="px-4 py-4">
														<span
															class={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
														>
															{user.is_active ? 'Aktif' : 'Non-Aktif'}
														</span>
													</td>
												</tr>
											{:else}
												<tr>
													<td colspan="6" class="py-12 text-center text-slate-400">
														Tidak ada data pasien yang sesuai pencarian.
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>

					<!-- ================================================== -->
					<!-- MENU 4: PENGATURAN (SEPARATE VIA SIDEBAR)          -->
					<!-- ================================================== -->
				{:else if activeMenu === 'pengaturan'}
					<div class="space-y-6">
						<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
							<h2 class="text-xl font-bold text-slate-900">Pengaturan Profil & Sistem Apoteker</h2>
							<p class="mt-1 text-xs text-slate-500">Konfigurasi akun apoteker dan integrasi sistem farmasi.</p>

							<div class="mt-6 space-y-4 max-w-md text-xs">
								<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<p class="font-bold text-slate-700">Identitas Apoteker</p>
									<p class="mt-1 text-sm font-black text-slate-900">{currentUser.name}</p>
									<p class="text-xs text-slate-500">ID: {currentUser.user_code || currentUser.id}</p>
									<p class="text-xs text-slate-500">Role: <span class="font-bold text-amber-700 uppercase">{currentUser.role}</span></p>
								</div>

								<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
									<p class="font-bold text-slate-700">Status Sistem & Data</p>
									<p class="mt-1 text-xs text-slate-600">Integrasi API Backend: <span class="font-bold text-emerald-600">Terhubung (Active)</span></p>
									<p class="text-xs text-slate-600">Total Pasien Terdaftar: <span class="font-bold text-blue-600">{userStore.list.length} Orang</span></p>
									<p class="text-xs text-slate-600">Stok Kritis Alerts: <span class="font-bold text-rose-600">{lowStockProducts.length} Produk</span></p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>

<!-- ========================================== -->
<!-- MODAL 1: TAMBAH PRODUK BARU MASTER        -->
<!-- ========================================== -->
{#if isAddProductModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
		<button
			onclick={() => (isAddProductModalOpen = false)}
			class="absolute inset-0 w-full h-full cursor-default"
			aria-label="Tutup Modal Tambah Produk"
		></button>
		<div
			class="relative z-10 w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
		>
			<h3 class="text-xl font-black text-slate-900 border-b border-slate-100 pb-3">
				➕ Tambah Produk Master Baru
			</h3>

			<form onsubmit={(e) => { e.preventDefault(); handleAddProduct(); }} class="mt-5 space-y-4 text-xs">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-product-code" class="block font-bold text-slate-700 mb-1">Kode / SKU *</label>
						<input
							id="new-product-code"
							bind:value={newProductForm.code}
							required
							placeholder="Misal: DRG-PCT-500"
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="new-product-category" class="block font-bold text-slate-700 mb-1">Kategori Produk *</label>
						<select
							id="new-product-category"
							bind:value={newProductForm.category}
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						>
							<option value="DRUG">Obat (DRUG)</option>
							<option value="CONSUMABLE">Bahan Habis Pakai (CONSUMABLE)</option>
							<option value="SUPPLEMENT">Suplemen & Vitamin (SUPPLEMENT)</option>
							<option value="MEDICAL_DEVICE">Alat Medis (MEDICAL_DEVICE)</option>
							<option value="OTHER">Lainnya (OTHER)</option>
						</select>
					</div>
				</div>

				<div>
					<label for="new-product-name" class="block font-bold text-slate-700 mb-1">Nama Produk *</label>
					<input
						id="new-product-name"
						bind:value={newProductForm.name}
						required
						placeholder="Misal: Paracetamol 500mg Tablet"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
					/>
				</div>

				<div class="grid grid-cols-3 gap-3">
					<div>
						<label for="new-product-unit" class="block font-bold text-slate-700 mb-1">Satuan *</label>
						<input
							id="new-product-unit"
							bind:value={newProductForm.unit}
							required
							placeholder="Strip / Botol / Pcs"
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="new-product-stock" class="block font-bold text-slate-700 mb-1">Stok Awal *</label>
						<input
							id="new-product-stock"
							type="number"
							bind:value={newProductForm.stock}
							min="0"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="new-product-min-stock" class="block font-bold text-slate-700 mb-1">Min Stok *</label>
						<input
							id="new-product-min-stock"
							type="number"
							bind:value={newProductForm.min_stock}
							min="0"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-product-buy-price" class="block font-bold text-slate-700 mb-1">Harga Beli (Rp) *</label>
						<input
							id="new-product-buy-price"
							type="number"
							bind:value={newProductForm.buy_price}
							min="0"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="new-product-sell-price" class="block font-bold text-slate-700 mb-1">Harga Jual (Rp) *</label>
						<input
							id="new-product-sell-price"
							type="number"
							bind:value={newProductForm.sell_price}
							min="0"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="new-product-description" class="block font-bold text-slate-700 mb-1">Deskripsi / Indikasi</label>
					<textarea
						id="new-product-description"
						bind:value={newProductForm.description}
						rows="2"
						placeholder="Catatan tambahan mengenai indikasi obat..."
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
					></textarea>
				</div>

				<div class="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
					<button
						type="button"
						onclick={() => (isAddProductModalOpen = false)}
						class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={productStore.isSubmitting}
						class="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 disabled:opacity-50"
					>
						{productStore.isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ========================================== -->
<!-- MODAL 2: RESTOCK BARANG (STOCK-IN)        -->
<!-- ========================================== -->
{#if isRestockModalOpen && selectedProductForRestock}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
		<button
			onclick={() => (isRestockModalOpen = false)}
			class="absolute inset-0 w-full h-full cursor-default"
			aria-label="Tutup Modal Restock"
		></button>
		<div
			class="relative z-10 w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl sm:p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
		>
			<div class="border-b border-slate-100 pb-3">
				<span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
					RESTOCK MASUK
				</span>
				<h3 class="text-xl font-black text-slate-900 mt-1">
					{selectedProductForRestock.name}
				</h3>
				<p class="text-xs text-slate-500">
					Stok saat ini: <strong class="text-slate-800">{selectedProductForRestock.stock} {selectedProductForRestock.unit}</strong>
				</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleRestock(); }} class="mt-4 space-y-4 text-xs">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="restock-quantity" class="block font-bold text-slate-700 mb-1">Jumlah Restock ({selectedProductForRestock.unit}) *</label>
						<input
							id="restock-quantity"
							type="number"
							bind:value={restockForm.quantity}
							min="1"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="restock-buy-price" class="block font-bold text-slate-700 mb-1">Harga Beli Supplier (Rp) *</label>
						<input
							id="restock-buy-price"
							type="number"
							bind:value={restockForm.buy_price}
							min="0"
							required
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="restock-exp-date" class="block font-bold text-slate-700 mb-1">
						Tanggal Kedaluwarsa (Expired Date)
						{#if selectedProductForRestock.category === 'DRUG' || selectedProductForRestock.category === 'MEDICAL_DEVICE'}
							<span class="text-rose-600 font-bold">* (Wajib untuk Obat/Alat Medis)</span>
						{/if}
					</label>
					<input
						id="restock-exp-date"
						type="date"
						bind:value={restockForm.exp_date}
						required={selectedProductForRestock.category === 'DRUG' || selectedProductForRestock.category === 'MEDICAL_DEVICE'}
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="restock-supplier" class="block font-bold text-slate-700 mb-1">Nama Supplier</label>
						<input
							id="restock-supplier"
							bind:value={restockForm.supplierName}
							placeholder="PT Medika Farma Utama"
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
					<div>
						<label for="restock-ref" class="block font-bold text-slate-700 mb-1">No. Faktur / Referensi</label>
						<input
							id="restock-ref"
							bind:value={restockForm.reference_number}
							placeholder="INV/2026/08/99"
							class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="restock-notes" class="block font-bold text-slate-700 mb-1">Catatan Restock</label>
					<input
						id="restock-notes"
						bind:value={restockForm.notes}
						placeholder="Penambahan batch stok baru"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
					/>
				</div>

				<div class="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
					<button
						type="button"
						onclick={() => (isRestockModalOpen = false)}
						class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={productStore.isSubmitting}
						class="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 disabled:opacity-50"
					>
						{productStore.isSubmitting ? 'Memproses...' : 'Proses Restock'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ========================================== -->
<!-- MODAL 3: DISPENSE RESEP (VERIFIKASI & SERAH) -->
<!-- ========================================== -->
{#if isDispenseModalOpen && selectedPrescriptionForDispense}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
		<button
			onclick={() => (isDispenseModalOpen = false)}
			class="absolute inset-0 w-full h-full cursor-default"
			aria-label="Tutup Modal Penyerahan Resep"
		></button>
		<div
			class="relative z-10 w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl sm:p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
		>
			<div class="border-b border-slate-100 pb-3">
				<span class="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">
					PENYERAHAN RESEP DOKTER
				</span>
				<h3 class="text-2xl font-black text-slate-900 mt-1">
					{selectedPrescriptionForDispense.patient_name}
				</h3>
				<p class="text-xs text-slate-500">
					No. TRX: <strong>{selectedPrescriptionForDispense.no_trx}</strong> • RM:
					<strong>{selectedPrescriptionForDispense.medical_record_number}</strong> • Dokter:
					<strong>{selectedPrescriptionForDispense.doctor_name}</strong>
				</p>
			</div>

			<div class="mt-4 space-y-4 text-xs">
				<div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
					<p class="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-2">
						Daftar Obat yang Harus Disiapkan:
					</p>
					<ul class="space-y-2">
						{#each selectedPrescriptionForDispense.items as item (item.id)}
							<li
								class="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-200 shadow-2xs"
							>
								<div>
									<p class="font-bold text-slate-900 text-sm">{item.product_name}</p>
									<p class="text-[11px] text-amber-800 font-semibold">{item.rules_using}</p>
								</div>
								<div class="text-right">
									<span
										class={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${item.product_stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
									>
										Sisa Stok: {item.product_stock}
									</span>
									<span class="block text-[9px] text-slate-400 mt-0.5">Dipotong: 1 Unit</span>
								</div>
							</li>
						{/each}
					</ul>
				</div>

				<div>
					<label for="dispenseVerifyNotes" class="block font-bold text-slate-700 mb-1">Catatan Verifikasi Apoteker</label>
					<textarea
						id="dispenseVerifyNotes"
						bind:value={dispenseVerifyNotes}
						rows="2"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs focus:border-amber-500 focus:bg-white outline-none"
					></textarea>
				</div>

				<div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900">
					💡 <strong>Sistem Otomatis:</strong> Menekan tombol di bawah akan mengubah status resep menjadi 
					<strong>COMPLETED</strong> dan langsung memotong stok obat di inventaris.
				</div>

				<div class="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
					<button
						type="button"
						onclick={() => (isDispenseModalOpen = false)}
						class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
					>
						Batal
					</button>
					<button
						type="button"
						onclick={handleDispense}
						disabled={productStore.isSubmitting}
						class="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
					>
						{productStore.isSubmitting ? 'Memproses Stok...' : '✅ Selesai / Ditebus'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
