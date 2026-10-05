<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import SkeletonBlock from '$lib/components/skeleton/SkeletonBlock.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import TableSkeleton from '$lib/components/ui/TableSkeleton.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import { formatDateTime, formatNumber, formatSigned } from '$lib/utils/format';
	import {
		logistik,
		PRODUCT_CATEGORY_LABELS,
		PRODUCT_CATEGORY_OPTIONS,
		WAREHOUSE_TYPE_LABELS,
		INVENTORY_LOG_TYPE_LABELS,
		INVENTORY_LOG_TYPE_VARIANTS,
		STOCK_REQUEST_STATUS_LABELS,
		STOCK_REQUEST_STATUS_VARIANTS,
		type InventoryLogType,
		type Product,
		type StockRequest
	} from '$lib/stores/logistik.svelte';
	import {
		productStore,
		PRODUCT_CATEGORY_LABELS as CATALOG_CATEGORY_LABELS,
		PRODUCT_CATEGORY_OPTIONS as CATALOG_CATEGORY_OPTIONS,
		type Product as CatalogProduct,
		type ProductCategory as CatalogCategory
	} from '$lib/stores/product.svelte';

	/* ================================================================== */
	/* Session & layout                                                   */
	/* ================================================================== */
	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<{ role: string; name: string; id: string; user_code?: string }>({
		role: 'logistik',
		name: '',
		id: '',
		user_code: ''
	});

	let activeMenu = $state('logistik');
	let isSidebarOpen = $state(false);

	/* ================================================================== */
	/* Ringkasan / Overview                                               */
	/* ================================================================== */
	async function loadOverview() {
		await Promise.all([
			logistik.fetchWarehouses(),
			logistik.fetchStockMatrix(),
			logistik.fetchInventoryLogs({ page: 1, limit: 5 })
		]);
	}

	/* ================================================================== */
	/* Master Produk (backend katalog via productStore)                   */
	/* ================================================================== */
	let productSearch = $state('');
	let productCategory = $state('ALL');
	let productPage = $state(1);
	let productLimit = $state(10);
	let productTimer: ReturnType<typeof setTimeout> | undefined;

	async function loadProducts() {
		await productStore.fetchProducts();
	}

	/**
	 * Filter kategori/pencarian/halaman di sisi klien memakai data yang sudah
	 * di-fetch — tidak ada request tambahan ke server saat ganti kategori.
	 */
	function applyProductFilter() {
		productStore.filterProducts({
			search: productSearch,
			category: productCategory,
			page: productPage,
			limit: productLimit
		});
	}

	function onProductSearch() {
		clearTimeout(productTimer);
		productTimer = setTimeout(() => {
			productPage = 1;
			applyProductFilter();
		}, 350);
	}

	let productModalOpen = $state(false);
	let productEditingId = $state<string | null>(null);
	let productFormError = $state('');
	let productForm = $state({
		code: '',
		name: '',
		category: 'DRUG' as CatalogCategory,
		unit: '',
		stock: 0,
		min_stock: 0,
		buy_price: 0,
		sell_price: 0,
		description: ''
	});

	function resetProductForm() {
		productForm = {
			code: '',
			name: '',
			category: 'DRUG',
			unit: '',
			stock: 0,
			min_stock: 0,
			buy_price: 0,
			sell_price: 0,
			description: ''
		};
		productFormError = '';
	}

	function openCreateProduct() {
		productEditingId = null;
		resetProductForm();
		productModalOpen = true;
	}

	function openEditProduct(product: CatalogProduct) {
		productEditingId = product.id;
		productForm = {
			code: product.code,
			name: product.name,
			category: product.category,
			unit: product.unit,
			stock: product.stock,
			min_stock: product.min_stock,
			buy_price: product.buy_price,
			sell_price: product.sell_price,
			description: product.description ?? ''
		};
		productFormError = '';
		productModalOpen = true;
	}

	async function submitProduct() {
		productFormError = '';
		if (!productForm.code.trim() || !productForm.name.trim() || !productForm.unit.trim()) {
			productFormError = 'Kode, nama, dan satuan produk wajib diisi.';
			return;
		}
		try {
			if (productEditingId) {
				await productStore.updateProduct(productEditingId, { ...productForm });
				toast.success('Produk diperbarui', `${productForm.name} berhasil disimpan.`);
			} else {
				await productStore.createProduct({ ...productForm });
				toast.success('Produk ditambahkan', `${productForm.name} berhasil ditambahkan.`);
			}
			productModalOpen = false;
			await loadProducts();
		} catch (err: any) {
			productFormError = err?.message ?? 'Gagal menyimpan produk.';
			toast.error('Gagal menyimpan', productFormError);
		}
	}

	async function confirmDeleteProduct(product: CatalogProduct) {
		if (!confirm(`Hapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
		try {
			await logistik.deleteProduct(product.id);
			toast.success('Produk dihapus', `${product.name} telah dihapus.`);
			await loadProducts();
			await loadOverview();
		} catch (err: any) {
			toast.error('Gagal menghapus', err?.message ?? 'Terjadi kesalahan.');
		}
	}

	/* ================================================================== */
	/* Penerimaan Barang / Pengadaan                                      */
	/* ================================================================== */
	let purchaseSearch = $state('');
	let purchasePage = $state(1);
	let purchaseLimit = $state(10);
	let purchaseTimer: ReturnType<typeof setTimeout> | undefined;

	async function loadPurchases() {
		await logistik.fetchPurchaseLogs({
			search: purchaseSearch,
			page: purchasePage,
			limit: purchaseLimit
		});
	}

	function onPurchaseSearch() {
		clearTimeout(purchaseTimer);
		purchaseTimer = setTimeout(() => {
			purchasePage = 1;
			loadPurchases();
		}, 350);
	}

	let restockOpen = $state(false);
	let restockError = $state('');
	let restockForm = $state({
		product_id: '',
		warehouse_id: '',
		quantity: 0,
		buy_price: 0,
		batch_number: '',
		exp_date: '',
		reference_number: '',
		supplier_name: '',
		notes: ''
	});

	function openRestock() {
		const firstProduct = logistik.products[0];
		restockForm = {
			product_id: firstProduct?.id ?? '',
			warehouse_id: logistik.warehouses[0]?.id ?? '',
			quantity: 0,
			buy_price: firstProduct?.buy_price ?? 0,
			batch_number: '',
			exp_date: '',
			reference_number: '',
			supplier_name: '',
			notes: ''
		};
		restockError = '';
		restockOpen = true;
	}

	function onRestockProductChange() {
		const product = logistik.productById(restockForm.product_id);
		if (product) restockForm.buy_price = product.buy_price;
	}

	async function submitRestock() {
		restockError = '';
		if (!restockForm.product_id) {
			restockError = 'Produk wajib dipilih.';
			return;
		}
		if (!restockForm.warehouse_id) {
			restockError = 'Gudang tujuan wajib dipilih.';
			return;
		}
		if (Number(restockForm.quantity) <= 0) {
			restockError = 'Kuantiti penerimaan harus lebih dari 0.';
			return;
		}
		try {
			await logistik.restockProduct({ ...restockForm });
			toast.success('Penerimaan dicatat', 'Stok berhasil ditambahkan ke gudang tujuan.');
			restockOpen = false;
			await loadPurchases();
			await loadOverview();
		} catch (err: any) {
			restockError = err?.message ?? 'Gagal menyimpan penerimaan.';
			toast.error('Gagal menyimpan', restockError);
		}
	}

	/* ================================================================== */
	/* Distribusi & Amprahan                                              */
	/* ================================================================== */
	let requestSearch = $state('');
	let requestStatus = $state('ALL');
	let requestPage = $state(1);
	let requestLimit = $state(10);
	let requestTimer: ReturnType<typeof setTimeout> | undefined;

	async function loadRequests() {
		await logistik.fetchStockRequests({
			search: requestSearch,
			status: requestStatus,
			page: requestPage,
			limit: requestLimit
		});
	}

	function onRequestSearch() {
		clearTimeout(requestTimer);
		requestTimer = setTimeout(() => {
			requestPage = 1;
			loadRequests();
		}, 350);
	}

	let detailRequest = $state<StockRequest | null>(null);
	let rejectOpen = $state(false);
	let rejectTargetId = $state<string | null>(null);
	let rejectReason = $state('');
	let rejectError = $state('');
	let processingRequestId = $state<string | null>(null);

	async function approveRequest(request: StockRequest) {
		processingRequestId = request.id;
		try {
			await logistik.approveStockRequest(request.id);
			toast.success('Permintaan disetujui', `${request.no_trx} telah disetujui.`);
			await loadRequests();
			await loadOverview();
		} catch (err: any) {
			toast.error('Gagal menyetujui', err?.message ?? 'Terjadi kesalahan.');
		} finally {
			processingRequestId = null;
		}
	}

	function openReject(request: StockRequest) {
		rejectTargetId = request.id;
		rejectReason = '';
		rejectError = '';
		rejectOpen = true;
	}

	async function submitReject() {
		rejectError = '';
		if (!rejectTargetId) return;
		if (!rejectReason.trim()) {
			rejectError = 'Alasan penolakan wajib diisi.';
			return;
		}
		try {
			await logistik.rejectStockRequest(rejectTargetId, rejectReason);
			toast.success('Permintaan ditolak', 'Permintaan telah ditolak.');
			rejectOpen = false;
			await loadRequests();
			await loadOverview();
		} catch (err: any) {
			rejectError = err?.message ?? 'Gagal menolak permintaan.';
			toast.error('Gagal menolak', rejectError);
		}
	}

	async function fulfillRequest(request: StockRequest) {
		if (!confirm(`Proses distribusi untuk ${request.no_trx}?`)) return;
		processingRequestId = request.id;
		try {
			await logistik.fulfillStockRequest(request.id);
			toast.success('Distribusi diproses', `${request.no_trx} telah dikirim ke unit tujuan.`);
			await loadRequests();
			await loadStock();
			await loadOverview();
		} catch (err: any) {
			toast.error('Gagal memproses', err?.message ?? 'Terjadi kesalahan.');
		} finally {
			processingRequestId = null;
		}
	}

	/* ================================================================== */
	/* Monitoring & Audit (matriks stok + audit trail)                    */
	/* ================================================================== */
	let tab = $state<'stok' | 'audit'>('stok');

	let stockSearch = $state('');
	let stockCategory = $state('ALL');
	let stockWarehouse = $state('ALL');
	let stockTimer: ReturnType<typeof setTimeout> | undefined;

	let logSearch = $state('');
	let logType = $state('ALL');
	let logWarehouse = $state('ALL');
	let logPage = $state(1);
	let logLimit = $state(10);
	let logTimer: ReturnType<typeof setTimeout> | undefined;

	const logTypeOptions = Object.keys(INVENTORY_LOG_TYPE_LABELS) as InventoryLogType[];

	async function loadStock() {
		await logistik.fetchStockMatrix({
			search: stockSearch,
			category: stockCategory,
			warehouse_id: stockWarehouse
		});
	}

	async function loadLogs() {
		await logistik.fetchInventoryLogs({
			search: logSearch,
			type: logType,
			warehouse_id: logWarehouse,
			page: logPage,
			limit: logLimit
		});
	}

	function onStockSearch() {
		clearTimeout(stockTimer);
		stockTimer = setTimeout(loadStock, 350);
	}

	function onLogSearch() {
		clearTimeout(logTimer);
		logTimer = setTimeout(() => {
			logPage = 1;
			loadLogs();
		}, 350);
	}

	function toggleTab(next: 'stok' | 'audit') {
		tab = next;
		if (next === 'stok') loadStock();
		else loadLogs();
	}

	let adjustOpen = $state(false);
	let adjustTarget = $state<Product | null>(null);
	let adjustWarehouse = $state('');
	let adjustNewStock = $state(0);
	let adjustReason = $state('');
	let adjustError = $state('');

	function openAdjust(product: Product, warehouseId?: string) {
		adjustTarget = product;
		adjustWarehouse = warehouseId ?? logistik.warehouses[0]?.id ?? '';
		adjustNewStock = logistik.stockAt(adjustWarehouse, product.id);
		adjustReason = '';
		adjustError = '';
		adjustOpen = true;
	}

	function onAdjustWarehouseChange() {
		if (adjustTarget) {
			adjustNewStock = logistik.stockAt(adjustWarehouse, adjustTarget.id);
		}
	}

	async function submitAdjust() {
		adjustError = '';
		if (!adjustTarget) return;
		if (!adjustReason.trim()) {
			adjustError = 'Alasan penyesuaian wajib diisi.';
			return;
		}
		try {
			await logistik.adjustStock({
				product_id: adjustTarget.id,
				warehouse_id: adjustWarehouse,
				new_stock: adjustNewStock,
				reason: adjustReason
			});
			toast.success('Penyesuaian dicatat', `Stok ${adjustTarget.name} diperbarui.`);
			adjustOpen = false;
			await loadStock();
			await loadLogs();
		} catch (err: any) {
			adjustError = err?.message ?? 'Gagal menyimpan penyesuaian.';
			toast.error('Gagal menyimpan', adjustError);
		}
	}

	/* ================================================================== */
	/* Navigation                                                         */
	/* ================================================================== */
	function handleMenuSelect(menuId: string) {
		activeMenu = menuId;
		switch (menuId) {
			case 'produk':
				loadProducts();
				break;
			case 'pengadaan':
				loadPurchases();
				break;
			case 'distribusi':
				loadRequests();
				break;
			case 'inventori':
				loadStock();
				loadLogs();
				break;
			case 'logistik':
			default:
				loadOverview();
				break;
		}
	}

	onMount(async () => {
		try {
			const profile = await validateSession();
			const normalizedRole = profile.role.toLowerCase();

			if (!['logistik', 'logistic'].includes(normalizedRole)) {
				isForbidden = true;
			} else {
				currentUser = profile;
				// Muat katalog produk dari backend sejak awal agar menu
				// Master Produk langsung menampilkan data tanpa perlu diklik.
				await Promise.all([loadOverview(), loadProducts()]);
			}
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});

	function rupiah(value: number): string {
		return `Rp ${formatNumber(value)}`;
	}

	function canApprove(request: StockRequest): boolean {
		return request.status === 'PENDING';
	}

	function canReject(request: StockRequest): boolean {
		return request.status === 'PENDING' || request.status === 'APPROVED';
	}

	function canFulfill(request: StockRequest): boolean {
		return request.status === 'APPROVED' || request.status === 'PARTIAL';
	}
</script>

<Title title="Logistik | Dashboard" />

<div class="flex h-screen overflow-hidden bg-[#f4f7fb] font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="logistik"
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
					class="text-sky-600"
					aria-label="Buka menu navigasi"
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
					class="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
				>
					ID: {currentUser.user_code || currentUser.id}
				</div>
			</header>
		{/if}

		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10' : ''}>
			{#if isLoading}
				<div class="space-y-6">
					<SkeletonBlock height="7.5rem" rounded="rounded-[24px]" />
					<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
						{#each Array(4)}
							<SkeletonBlock height="6.5rem" rounded="rounded-[24px]" />
						{/each}
					</div>
					<div class="grid gap-6 lg:grid-cols-2">
						<SkeletonBlock height="18rem" rounded="rounded-[24px]" />
						<SkeletonBlock height="18rem" rounded="rounded-[24px]" />
					</div>
				</div>
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- HEADER HERO -->
				<div
					class="relative mb-6 overflow-hidden rounded-[24px] bg-gradient-to-r from-slate-800 to-sky-600 p-6 text-white shadow-lg sm:p-8"
				>
					<div class="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl"></div>
					<div
						class="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
					>
						<div>
							<h1 class="text-3xl font-black sm:text-4xl">
								Selamat Datang, {currentUser.name || 'Petugas Logistik'}! 📦
							</h1>
							<p class="mt-2 text-sky-50">
								Pantau ketersediaan stok, penerimaan barang, dan distribusi antar unit dalam satu
								dasbor.
							</p>
						</div>
						<div class="rounded-2xl border border-white/20 bg-white/15 px-5 py-3 backdrop-blur-md">
							<p class="text-[10px] font-bold tracking-widest text-sky-100 uppercase">
								Permintaan Menunggu
							</p>
							<p class="mt-0.5 text-xl font-black tracking-wider text-white">
								{logistik.pendingRequestCount} Amprahan
							</p>
							<p class="mt-0.5 text-[11px] font-medium text-sky-100">Perlu diproses</p>
						</div>
					</div>
				</div>

				<!-- ===================== -->
				<!-- MENU: RINGKASAN       -->
				<!-- ===================== -->
				{#if activeMenu === 'logistik'}
					<div class="space-y-6">
						<!-- Stat cards -->
						<div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
							<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Produk</p>
								<p class="mt-2 text-3xl font-black text-slate-900">
									{formatNumber(
										productStore.productsSummary?.total_products ?? productStore.products.length
									)}
								</p>
								<p class="mt-1 text-xs font-medium text-slate-400">Terdaftar di master katalog</p>
							</div>
							<div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Gudang</p>
								<p class="mt-2 text-3xl font-black text-slate-900">
									{formatNumber(logistik.warehouses.length)}
								</p>
								<p class="mt-1 text-xs font-medium text-slate-400">Lokasi penyimpanan aktif</p>
							</div>
							<div class="rounded-[24px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-amber-600 uppercase">Stok Menipis</p>
								<p class="mt-2 text-3xl font-black text-amber-700">
									{formatNumber(logistik.lowStockRows.length)}
								</p>
								<p class="mt-1 text-xs font-medium text-amber-500">Di bawah batas minimum</p>
							</div>
							<div class="rounded-[24px] border border-sky-200 bg-sky-50 p-6 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-sky-600 uppercase">
									Permintaan Menunggu
								</p>
								<p class="mt-2 text-3xl font-black text-sky-700">
									{formatNumber(logistik.pendingRequestCount)}
								</p>
								<p class="mt-1 text-xs font-medium text-sky-500">Amprahan belum selesai</p>
							</div>
						</div>

						<div class="grid gap-6 lg:grid-cols-2">
							<!-- Low stock -->
							<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<div class="mb-5 flex items-center justify-between">
									<h2 class="text-lg font-bold text-slate-900">Peringatan Stok Menipis</h2>
									<span
										class="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700"
									>
										{logistik.lowStockRows.length} item
									</span>
								</div>
								{#if logistik.lowStockRows.length === 0}
									<EmptyState
										icon="✅"
										title="Semua stok aman"
										description="Tidak ada produk di bawah batas minimum."
									/>
								{:else}
									<div class="space-y-3">
										{#each logistik.lowStockRows.slice(0, 5) as row (row.product.id + row.warehouse.id)}
											<div
												class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
											>
												<div class="min-w-0">
													<p class="truncate text-sm font-bold text-slate-800">
														{row.product.name}
													</p>
													<p class="text-xs text-slate-400">
														{row.warehouse.name} · min {formatNumber(row.min_stock)}
													</p>
												</div>
												<div class="ml-3 shrink-0 text-right">
													<p class="text-sm font-black text-amber-600">
														{formatNumber(row.stock)}
													</p>
													<p class="text-[11px] text-slate-400">
														kurang {formatNumber(row.deficit)}
													</p>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</section>

							<!-- Recent activity -->
							<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
								<div class="mb-5 flex items-center justify-between">
									<h2 class="text-lg font-bold text-slate-900">Aktivitas Mutasi Terbaru</h2>
									<button
										onclick={() => handleMenuSelect('inventori')}
										class="text-xs font-bold text-sky-600 hover:underline"
									>
										Lihat Audit &rarr;
									</button>
								</div>
								{#if logistik.logRows.length === 0}
									<EmptyState
										icon="🗂️"
										title="Belum ada aktivitas"
										description="Mutasi stok akan muncul di sini."
									/>
								{:else}
									<div class="space-y-3">
										{#each logistik.logRows.slice(0, 5) as log (log.id)}
											<div
												class="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
											>
												<div class="min-w-0">
													<p class="truncate text-sm font-bold text-slate-800">
														{logistik.productById(log.product_id)?.name ?? '-'}
													</p>
													<p class="text-xs text-slate-400">
														{formatDateTime(log.createdAt)} ·
														{logistik.warehouseById(log.warehouse_id)?.name ?? '-'}
													</p>
												</div>
												<div class="shrink-0 text-right">
													<Badge variant={INVENTORY_LOG_TYPE_VARIANTS[log.type]}>
														{INVENTORY_LOG_TYPE_LABELS[log.type]}
													</Badge>
													<p
														class="mt-1 text-xs font-bold {log.quantity < 0
															? 'text-red-600'
															: 'text-emerald-600'}"
													>
														{formatSigned(log.quantity)}
													</p>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</section>
						</div>
					</div>

					<!-- ===================== -->
					<!-- MENU: MASTER PRODUK   -->
					<!-- ===================== -->
				{:else if activeMenu === 'produk'}
					<div class="space-y-6">
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Master Produk</h2>
								<p class="mt-1 text-sm text-slate-500">
									Kelola katalog produk, kategori, satuan, dan harga dasar.
								</p>
							</div>
							<button
								onclick={openCreateProduct}
								class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90"
							>
								➕ Tambah Produk
							</button>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white">
							<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
								<input
									type="search"
									placeholder="Cari nama atau kode produk…"
									class="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={productSearch}
									oninput={onProductSearch}
								/>
								<select
									class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={productCategory}
									onchange={() => {
										productPage = 1;
										applyProductFilter();
									}}
								>
									<option value="ALL">Semua kategori</option>
									{#each CATALOG_CATEGORY_OPTIONS as opt (opt.value)}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>

							{#if productStore.isLoadingProducts}
								<TableSkeleton rows={6} cols={6} />
							{:else if productStore.products.length === 0}
								<EmptyState
									icon="📦"
									title="Tidak ada produk"
									description="Ubah filter atau tambahkan produk baru."
								/>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr
												class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
											>
												<th class="px-4 py-2.5 font-medium">Produk</th>
												<th class="px-4 py-2.5 font-medium">Kategori</th>
												<th class="px-4 py-2.5 font-medium">Satuan</th>
												<th class="px-4 py-2.5 text-right font-medium">Stok</th>
												<th class="px-4 py-2.5 text-right font-medium">Min. Stok</th>
												<th class="px-4 py-2.5 text-right font-medium">Harga Beli</th>
												<th class="px-4 py-2.5 text-right font-medium">Harga Jual</th>
												<th class="px-4 py-2.5 text-right font-medium">Aksi</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each productStore.products as product (product.id)}
												<tr class="hover:bg-slate-50">
													<td class="px-4 py-3">
														<p class="font-medium text-slate-800">{product.name}</p>
														<p class="text-xs text-slate-400">{product.code}</p>
													</td>
													<td class="px-4 py-3">
														<Badge variant="slate">
															{CATALOG_CATEGORY_LABELS[product.category]}
														</Badge>
													</td>
													<td class="px-4 py-3 text-slate-600">{product.unit}</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{formatNumber(product.stock)}
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{formatNumber(product.min_stock)}
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{rupiah(product.buy_price)}
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{rupiah(product.sell_price)}
													</td>
													<td class="px-4 py-3 text-right">
														<div class="flex justify-end gap-1">
															<button
																type="button"
																class="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
																onclick={() => openEditProduct(product)}
															>
																Edit
															</button>
															<button
																type="button"
																class="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
																onclick={() => confirmDeleteProduct(product)}
															>
																Hapus
															</button>
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<Pagination
									meta={productStore.productsMeta}
									onpage={(page) => {
										productPage = page;
										applyProductFilter();
									}}
									label="produk"
								/>
							{/if}
						</div>
					</div>

					<!-- ===================== -->
					<!-- MENU: PENERIMAAN       -->
					<!-- ===================== -->
				{:else if activeMenu === 'pengadaan'}
					<div class="space-y-6">
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Penerimaan Barang</h2>
								<p class="mt-1 text-sm text-slate-500">
									Catat penerimaan stok dari supplier ke gudang tujuan.
								</p>
							</div>
							<button
								onclick={openRestock}
								class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90"
							>
								📥 Catat Penerimaan
							</button>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white">
							<div class="border-b border-slate-200 px-4 py-3">
								<input
									type="search"
									placeholder="Cari produk, referensi, atau batch…"
									class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={purchaseSearch}
									oninput={onPurchaseSearch}
								/>
							</div>

							{#if logistik.isLoadingPurchases}
								<TableSkeleton rows={6} cols={6} />
							{:else if logistik.purchaseRows.length === 0}
								<EmptyState
									icon="📥"
									title="Belum ada penerimaan"
									description="Catat penerimaan barang untuk melihat riwayatnya."
								/>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr
												class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
											>
												<th class="px-4 py-2.5 font-medium">Waktu</th>
												<th class="px-4 py-2.5 font-medium">Produk</th>
												<th class="px-4 py-2.5 font-medium">Gudang</th>
												<th class="px-4 py-2.5 font-medium">Batch / ED</th>
												<th class="px-4 py-2.5 font-medium">Referensi</th>
												<th class="px-4 py-2.5 text-right font-medium">Masuk</th>
												<th class="px-4 py-2.5 text-right font-medium">Saldo</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each logistik.purchaseRows as log (log.id)}
												<tr class="hover:bg-slate-50">
													<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
														{formatDateTime(log.createdAt)}
													</td>
													<td class="px-4 py-3 text-slate-700">
														{logistik.productById(log.product_id)?.name ?? '-'}
													</td>
													<td class="px-4 py-3 text-slate-600">
														{logistik.warehouseById(log.warehouse_id)?.name ?? '-'}
													</td>
													<td class="px-4 py-3 text-xs text-slate-500">
														<p class="font-mono">{log.batch_number ?? '-'}</p>
														<p>{log.exp_date ?? '-'}</p>
													</td>
													<td class="px-4 py-3">
														<p class="font-mono text-xs text-slate-600">
															{log.reference ?? '-'}
														</p>
														{#if log.notes}
															<p class="text-xs text-slate-400">{log.notes}</p>
														{/if}
													</td>
													<td
														class="px-4 py-3 text-right font-medium text-emerald-600"
													>
														{formatSigned(log.quantity)}
													</td>
													<td class="px-4 py-3 text-right text-slate-700">
														{formatNumber(log.balance_after)}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<Pagination
									meta={logistik.purchaseMeta}
									onpage={(page) => {
										purchasePage = page;
										loadPurchases();
									}}
									label="penerimaan"
								/>
							{/if}
						</div>
					</div>

					<!-- ===================== -->
					<!-- MENU: DISTRIBUSI       -->
					<!-- ===================== -->
				{:else if activeMenu === 'distribusi'}
					<div class="space-y-6">
						<div
							class="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h2 class="text-xl font-bold text-slate-900">Distribusi & Amprahan</h2>
								<p class="mt-1 text-sm text-slate-500">
									Setujui permintaan unit dan proses pengiriman antar gudang.
								</p>
							</div>
							<span
								class="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700"
							>
								{logistik.pendingRequestCount} Menunggu
							</span>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white">
							<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
								<input
									type="search"
									placeholder="Cari no. permintaan, unit, atau pemohon…"
									class="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={requestSearch}
									oninput={onRequestSearch}
								/>
								<select
									class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={requestStatus}
									onchange={() => {
										requestPage = 1;
										loadRequests();
									}}
								>
									<option value="ALL">Semua status</option>
									{#each Object.entries(STOCK_REQUEST_STATUS_LABELS) as [value, label] (value)}
										<option value={value}>{label}</option>
									{/each}
								</select>
							</div>

							{#if logistik.isLoadingRequests}
								<TableSkeleton rows={6} cols={6} />
							{:else if logistik.requestRows.length === 0}
								<EmptyState
									icon="🚚"
									title="Tidak ada permintaan"
									description="Belum ada amprahan yang cocok dengan filter."
								/>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr
												class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
											>
												<th class="px-4 py-2.5 font-medium">No. Permintaan</th>
												<th class="px-4 py-2.5 font-medium">Pemohon / Unit</th>
												<th class="px-4 py-2.5 font-medium">Rute</th>
												<th class="px-4 py-2.5 text-right font-medium">Item</th>
												<th class="px-4 py-2.5 font-medium">Waktu</th>
												<th class="px-4 py-2.5 font-medium">Status</th>
												<th class="px-4 py-2.5 text-right font-medium">Aksi</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each logistik.requestRows as request (request.id)}
												<tr class="hover:bg-slate-50">
													<td class="px-4 py-3">
														<button
															type="button"
															class="font-mono text-xs font-semibold text-sky-700 hover:underline"
															onclick={() => (detailRequest = request)}
														>
															{request.no_trx}
														</button>
													</td>
													<td class="px-4 py-3">
														<p class="font-medium text-slate-800">{request.requester}</p>
														<p class="text-xs text-slate-400">{request.unit_name}</p>
													</td>
													<td class="px-4 py-3 text-xs text-slate-500">
														<p>{logistik.warehouseById(request.from_warehouse_id)?.name ?? '-'}</p>
														<p class="text-slate-300">↓</p>
														<p>{logistik.warehouseById(request.to_warehouse_id)?.name ?? '-'}</p>
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{request.items.length}
													</td>
													<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
														{formatDateTime(request.requested_at)}
													</td>
													<td class="px-4 py-3">
														<Badge variant={STOCK_REQUEST_STATUS_VARIANTS[request.status]}>
															{STOCK_REQUEST_STATUS_LABELS[request.status]}
														</Badge>
													</td>
													<td class="px-4 py-3">
														<div class="flex flex-wrap justify-end gap-1">
															{#if canApprove(request)}
																<button
																	type="button"
																	disabled={processingRequestId === request.id}
																	class="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
																	onclick={() => approveRequest(request)}
																>
																	Setujui
																</button>
															{/if}
															{#if canFulfill(request)}
																<button
																	type="button"
																	disabled={processingRequestId === request.id}
																	class="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
																	onclick={() => fulfillRequest(request)}
																>
																	Kirim
																</button>
															{/if}
															{#if canReject(request)}
																<button
																	type="button"
																	disabled={processingRequestId === request.id}
																	class="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
																	onclick={() => openReject(request)}
																>
																	Tolak
																</button>
															{/if}
															<button
																type="button"
																class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
																onclick={() => (detailRequest = request)}
															>
																Detail
															</button>
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<Pagination
									meta={logistik.requestMeta}
									onpage={(page) => {
										requestPage = page;
										loadRequests();
									}}
									label="permintaan"
								/>
							{/if}
						</div>
					</div>

					<!-- ===================== -->
					<!-- MENU: MONITORING/AUDIT -->
					<!-- ===================== -->
				{:else if activeMenu === 'inventori'}
					<div class="space-y-5">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Monitoring &amp; Audit Stok</h2>
								<p class="text-xs text-slate-500">
									Matriks ketersediaan stok antar gudang dan audit trail mutasi (InventoryLogs).
								</p>
							</div>
							<div class="flex gap-1 rounded-lg bg-slate-100 p-1">
								<button
									type="button"
									class="rounded-md px-3 py-1.5 text-xs font-medium transition {tab === 'stok'
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									onclick={() => toggleTab('stok')}
								>
									Matriks Stok
								</button>
								<button
									type="button"
									class="rounded-md px-3 py-1.5 text-xs font-medium transition {tab === 'audit'
										? 'bg-white text-slate-900 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									onclick={() => toggleTab('audit')}
								>
									Audit Trail
								</button>
							</div>
						</div>

						{#if tab === 'stok'}
							<div class="rounded-xl border border-slate-200 bg-white">
								<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
									<input
										type="search"
										placeholder="Cari produk…"
										class="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={stockSearch}
										oninput={onStockSearch}
									/>
									<select
										class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={stockCategory}
										onchange={loadStock}
									>
										<option value="ALL">Semua kategori</option>
										{#each PRODUCT_CATEGORY_OPTIONS as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
									<select
										class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={stockWarehouse}
										onchange={loadStock}
									>
										<option value="ALL">Semua gudang</option>
										{#each logistik.warehouses as w (w.id)}
											<option value={w.id}>{w.name}</option>
										{/each}
									</select>
								</div>

								{#if logistik.isLoadingStock}
									<TableSkeleton rows={6} cols={5} />
								{:else if logistik.stockMatrix.length === 0}
									<EmptyState
										icon="🔍"
										title="Tidak ada produk"
										description="Ubah filter untuk melihat data stok."
									/>
								{:else}
									<div class="overflow-x-auto">
										<table class="w-full text-sm">
											<thead>
												<tr
													class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
												>
													<th class="px-4 py-2.5 font-medium">Produk</th>
													{#each logistik.warehouses as w (w.id)}
														<th class="px-4 py-2.5 text-right font-medium">{w.name}</th>
													{/each}
													<th class="px-4 py-2.5 text-right font-medium">Total</th>
													<th class="px-4 py-2.5 text-right font-medium">Aksi</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-slate-100">
												{#each logistik.stockMatrix as row (row.product.id)}
													<tr class="hover:bg-slate-50">
														<td class="px-4 py-3">
															<p class="font-medium text-slate-800">{row.product.name}</p>
															<p class="text-xs text-slate-400">
																{row.product.code} ·
																{PRODUCT_CATEGORY_LABELS[row.product.category]}
															</p>
														</td>
														{#each row.cells as cell (cell.warehouse.id)}
															<td
																class="px-4 py-3 text-right {cell.is_low
																	? 'font-medium text-amber-600'
																	: 'text-slate-600'}"
															>
																{formatNumber(cell.stock)}
															</td>
														{/each}
														<td class="px-4 py-3 text-right font-semibold text-slate-800">
															{formatNumber(row.total)}
														</td>
														<td class="px-4 py-3 text-right">
															<button
																type="button"
																class="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
																onclick={() => openAdjust(row.product)}
															>
																Koreksi
															</button>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>
						{:else}
							<div class="rounded-xl border border-slate-200 bg-white">
								<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
									<input
										type="search"
										placeholder="Cari produk, referensi, atau catatan…"
										class="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={logSearch}
										oninput={onLogSearch}
									/>
									<select
										class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={logType}
										onchange={() => {
											logPage = 1;
											loadLogs();
										}}
									>
										<option value="ALL">Semua aktivitas</option>
										{#each logTypeOptions as type (type)}
											<option value={type}>{INVENTORY_LOG_TYPE_LABELS[type]}</option>
										{/each}
									</select>
									<select
										class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
										bind:value={logWarehouse}
										onchange={() => {
											logPage = 1;
											loadLogs();
										}}
									>
										<option value="ALL">Semua gudang</option>
										{#each logistik.warehouses as w (w.id)}
											<option value={w.id}>{w.name}</option>
										{/each}
									</select>
								</div>

								{#if logistik.isLoadingLogs}
									<TableSkeleton rows={6} cols={6} />
								{:else if logistik.logRows.length === 0}
									<EmptyState
										icon="🗂️"
										title="Tidak ada mutasi"
										description="Belum ada aktivitas stok yang cocok dengan filter."
									/>
								{:else}
									<div class="overflow-x-auto">
										<table class="w-full text-sm">
											<thead>
												<tr
													class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
												>
													<th class="px-4 py-2.5 font-medium">Waktu</th>
													<th class="px-4 py-2.5 font-medium">Produk</th>
													<th class="px-4 py-2.5 font-medium">Lokasi</th>
													<th class="px-4 py-2.5 font-medium">Aktivitas</th>
													<th class="px-4 py-2.5 text-right font-medium">Mutasi</th>
													<th class="px-4 py-2.5 text-right font-medium">Saldo</th>
													<th class="px-4 py-2.5 font-medium">Referensi / Catatan</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-slate-100">
												{#each logistik.logRows as log (log.id)}
													<tr class="hover:bg-slate-50">
														<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
															{formatDateTime(log.createdAt)}
														</td>
														<td class="px-4 py-3 text-slate-700">
															{logistik.productById(log.product_id)?.name ?? '-'}
														</td>
														<td class="px-4 py-3 text-slate-600">
															{logistik.warehouseById(log.warehouse_id)?.name ?? '-'}
														</td>
														<td class="px-4 py-3">
															<Badge variant={INVENTORY_LOG_TYPE_VARIANTS[log.type]}>
																{INVENTORY_LOG_TYPE_LABELS[log.type]}
															</Badge>
														</td>
														<td
															class="px-4 py-3 text-right font-medium {log.quantity < 0
																? 'text-red-600'
																: 'text-emerald-600'}"
														>
															{formatSigned(log.quantity)}
														</td>
														<td class="px-4 py-3 text-right text-slate-700">
															{formatNumber(log.balance_after)}
														</td>
														<td class="px-4 py-3">
															<p class="font-mono text-xs text-slate-600">
																{log.reference ?? '-'}
															</p>
															{#if log.notes}
																<p class="text-xs text-slate-400">{log.notes}</p>
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>

									<Pagination
										meta={logistik.logMeta}
										onpage={(page) => {
											logPage = page;
											loadLogs();
										}}
										label="mutasi"
									/>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</main>
</div>

<!-- ================================================================== -->
<!-- MODAL: Produk (create / edit)                                       -->
<!-- ================================================================== -->
<Modal
	open={productModalOpen}
	title={productEditingId ? 'Edit Produk' : 'Tambah Produk'}
	description="Lengkapi data master produk di bawah ini."
	size="md"
	onclose={() => (productModalOpen = false)}
>
	{#if productFormError}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
			{productFormError}
		</div>
	{/if}

	<div class="grid gap-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Kode Produk *</span>
				<input
					bind:value={productForm.code}
					placeholder="OBT-0001"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Nama Produk *</span>
				<input
					bind:value={productForm.name}
					placeholder="Paracetamol 500 mg"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Kategori</span>
				<select
					bind:value={productForm.category}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				>
					{#each CATALOG_CATEGORY_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Satuan *</span>
				<input
					bind:value={productForm.unit}
					placeholder="Strip / Box / Pcs"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Stok Awal</span>
				<input
					type="number"
					min="0"
					bind:value={productForm.stock}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Min. Stok</span>
				<input
					type="number"
					min="0"
					bind:value={productForm.min_stock}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Harga Beli</span>
				<input
					type="number"
					min="0"
					bind:value={productForm.buy_price}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Harga Jual</span>
				<input
					type="number"
					min="0"
					bind:value={productForm.sell_price}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<label class="block">
			<span class="text-xs font-medium text-slate-600">Deskripsi</span>
			<textarea
				rows="2"
				bind:value={productForm.description}
				placeholder="Deskripsi singkat produk (opsional)"
				class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
			></textarea>
		</label>
	</div>

	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
			onclick={() => (productModalOpen = false)}
		>
			Batal
		</button>
		<button
			type="button"
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
			disabled={productStore.isSubmitting}
			onclick={submitProduct}
		>
			{productStore.isSubmitting
				? 'Menyimpan…'
				: productEditingId
					? 'Simpan Perubahan'
					: 'Tambah Produk'}
		</button>
	{/snippet}
</Modal>

<!-- ================================================================== -->
<!-- MODAL: Penerimaan barang                                            -->
<!-- ================================================================== -->
<Modal
	open={restockOpen}
	title="Catat Penerimaan Barang"
	description="Input stok masuk dari supplier ke gudang tujuan."
	size="md"
	onclose={() => (restockOpen = false)}
>
	{#if restockError}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
			{restockError}
		</div>
	{/if}

	<div class="grid gap-4">
		<label class="block">
			<span class="text-xs font-medium text-slate-600">Produk *</span>
			<select
				bind:value={restockForm.product_id}
				onchange={onRestockProductChange}
				class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
			>
				{#each logistik.products as product (product.id)}
					<option value={product.id}>{product.name} ({product.code})</option>
				{/each}
			</select>
		</label>

		<label class="block">
			<span class="text-xs font-medium text-slate-600">Gudang Tujuan *</span>
			<select
				bind:value={restockForm.warehouse_id}
				class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
			>
				{#each logistik.warehouses as warehouse (warehouse.id)}
					<option value={warehouse.id}>
						{warehouse.name} · {WAREHOUSE_TYPE_LABELS[warehouse.type]}
					</option>
				{/each}
			</select>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Kuantiti Masuk *</span>
				<input
					type="number"
					min="1"
					bind:value={restockForm.quantity}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Harga Beli Satuan</span>
				<input
					type="number"
					min="0"
					bind:value={restockForm.buy_price}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">No. Batch</span>
				<input
					bind:value={restockForm.batch_number}
					placeholder="B2401-01"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Kedaluwarsa (Exp. Date)</span>
				<input
					type="date"
					bind:value={restockForm.exp_date}
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">No. Referensi (PO/Surat Jalan)</span>
				<input
					bind:value={restockForm.reference_number}
					placeholder="PO-2024-0091"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Supplier</span>
				<input
					bind:value={restockForm.supplier_name}
					placeholder="PT Kimia Farma Trading"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
		</div>

		<label class="block">
			<span class="text-xs font-medium text-slate-600">Catatan</span>
			<textarea
				rows="2"
				bind:value={restockForm.notes}
				placeholder="Catatan tambahan (opsional)"
				class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
			></textarea>
		</label>
	</div>

	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
			onclick={() => (restockOpen = false)}
		>
			Batal
		</button>
		<button
			type="button"
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
			disabled={logistik.isSubmitting}
			onclick={submitRestock}
		>
			{logistik.isSubmitting ? 'Menyimpan…' : 'Simpan Penerimaan'}
		</button>
	{/snippet}
</Modal>

<!-- ================================================================== -->
<!-- MODAL: Detail permintaan distribusi                                 -->
<!-- ================================================================== -->
<Modal
	open={!!detailRequest}
	title={`Detail Permintaan ${detailRequest?.no_trx ?? ''}`}
	description="Rincian item yang diminta unit operasional."
	size="md"
	onclose={() => (detailRequest = null)}
>
	{#if detailRequest}
		<div class="space-y-4">
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="rounded-lg bg-slate-50 px-4 py-3">
					<p class="text-[10px] font-bold text-slate-400 uppercase">Pemohon / Unit</p>
					<p class="text-sm font-bold text-slate-800">{detailRequest.requester}</p>
					<p class="text-xs text-slate-500">{detailRequest.unit_name}</p>
				</div>
				<div class="rounded-lg bg-slate-50 px-4 py-3">
					<p class="mb-1 text-[10px] font-bold text-slate-400 uppercase">Status</p>
					<Badge variant={STOCK_REQUEST_STATUS_VARIANTS[detailRequest.status]}>
						{STOCK_REQUEST_STATUS_LABELS[detailRequest.status]}
					</Badge>
				</div>
				<div class="rounded-lg bg-slate-50 px-4 py-3">
					<p class="text-[10px] font-bold text-slate-400 uppercase">Gudang Asal</p>
					<p class="text-sm text-slate-700">
						{logistik.warehouseById(detailRequest.from_warehouse_id)?.name ?? '-'}
					</p>
				</div>
				<div class="rounded-lg bg-slate-50 px-4 py-3">
					<p class="text-[10px] font-bold text-slate-400 uppercase">Gudang Tujuan</p>
					<p class="text-sm text-slate-700">
						{logistik.warehouseById(detailRequest.to_warehouse_id)?.name ?? '-'}
					</p>
				</div>
			</div>

			{#if detailRequest.notes}
				<p class="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
					{detailRequest.notes}
				</p>
			{/if}

			<div class="overflow-hidden rounded-lg border border-slate-200">
				<table class="w-full text-sm">
					<thead class="bg-slate-50 text-xs uppercase text-slate-500">
						<tr>
							<th class="px-3 py-2 text-left font-medium">Produk</th>
							<th class="px-3 py-2 text-right font-medium">Diminta</th>
							<th class="px-3 py-2 text-right font-medium">Disetujui</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each detailRequest.items as item (item.id)}
							<tr>
								<td class="px-3 py-2 text-slate-700">
									{logistik.productById(item.product_id)?.name ?? '-'}
								</td>
								<td class="px-3 py-2 text-right text-slate-600">
									{formatNumber(item.requested_qty)}
								</td>
								<td class="px-3 py-2 text-right font-medium text-slate-800">
									{item.approved_qty === null ? '-' : formatNumber(item.approved_qty)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
			onclick={() => (detailRequest = null)}
		>
			Tutup
		</button>
	{/snippet}
</Modal>

<!-- ================================================================== -->
<!-- MODAL: Tolak permintaan                                             -->
<!-- ================================================================== -->
<Modal
	open={rejectOpen}
	title="Tolak Permintaan"
	description="Berikan alasan penolakan agar unit pemohon mendapat konteks."
	size="md"
	onclose={() => (rejectOpen = false)}
>
	{#if rejectError}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
			{rejectError}
		</div>
	{/if}

	<label class="block">
		<span class="text-xs font-medium text-slate-600">Alasan Penolakan *</span>
		<textarea
			rows="3"
			bind:value={rejectReason}
			placeholder="Contoh: pengajuan duplikat, stok tidak mencukupi, dsb."
			class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
		></textarea>
	</label>

	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
			onclick={() => (rejectOpen = false)}
		>
			Batal
		</button>
		<button
			type="button"
			class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
			disabled={logistik.isSubmitting}
			onclick={submitReject}
		>
			{logistik.isSubmitting ? 'Memproses…' : 'Tolak Permintaan'}
		</button>
	{/snippet}
</Modal>

<!-- ================================================================== -->
<!-- MODAL: Penyesuaian stok (stock opname)                              -->
<!-- ================================================================== -->
<Modal
	open={adjustOpen}
	title="Penyesuaian Stok (Stock Opname)"
	description="Koreksi stok fisik bila ditemukan selisih di lapangan."
	size="md"
	onclose={() => (adjustOpen = false)}
>
	{#if adjustTarget}
		{#if adjustError}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
				{adjustError}
			</div>
		{/if}

		<div class="mb-4 rounded-lg bg-slate-50 px-4 py-3">
			<p class="text-sm font-medium text-slate-800">{adjustTarget.name}</p>
			<p class="text-xs text-slate-500">
				{adjustTarget.code} · Satuan {adjustTarget.unit} · Stok sistem saat ini
				<span class="font-medium text-slate-700">
					{formatNumber(logistik.stockAt(adjustWarehouse, adjustTarget.id))}
				</span>
			</p>
		</div>

		<div class="grid gap-4">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Lokasi Gudang</span>
				<select
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
					bind:value={adjustWarehouse}
					onchange={onAdjustWarehouseChange}
				>
					{#each logistik.warehouses as w (w.id)}
						<option value={w.id}>{w.name}</option>
					{/each}
				</select>
			</label>

			<label class="block">
				<span class="text-xs font-medium text-slate-600">Stok Fisik (Hasil Hitung)</span>
				<input
					type="number"
					min="0"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
					bind:value={adjustNewStock}
				/>
			</label>

			<label class="block">
				<span class="text-xs font-medium text-slate-600">Alasan Penyesuaian *</span>
				<textarea
					rows="3"
					class="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
					bind:value={adjustReason}
					placeholder="Contoh: selisih hasil opname, barang rusak, kadaluwarsa, dsb."
				></textarea>
			</label>
		</div>
	{/if}

	{#snippet footer()}
		<button
			type="button"
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
			onclick={() => (adjustOpen = false)}
		>
			Batal
		</button>
		<button
			type="button"
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
			disabled={logistik.isSubmitting}
			onclick={submitAdjust}
		>
			{logistik.isSubmitting ? 'Menyimpan…' : 'Simpan Penyesuaian'}
		</button>
	{/snippet}
</Modal>
