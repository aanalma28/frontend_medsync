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
		STOCK_BATCH_STATUS_LABELS,
		STOCK_BATCH_STATUS_VARIANTS,
		type InventoryLogType,
		type Product,
		type StockBatch,
		type StockBatchAllocation,
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

	/**
	 * Peringatan stok menipis di menu Ringkasan kini bersumber dari katalog
	 * produk hasil fetch (productStore.catalog) — bukan lagi dari matriks stok
	 * per gudang. Produk dengan stok <= min_stock (atau ditandai backend)
	 * ditampilkan, diurutkan dari defisit terbesar.
	 */
	let lowStockProducts = $derived(
		productStore.catalog
			.filter((p) => p.is_low_stock || p.is_out_of_stock || p.stock <= p.min_stock)
			.sort((a, b) => b.min_stock - b.stock - (a.min_stock - a.stock))
	);

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
	let purchaseWarehouse = $state('ALL');
	let purchaseStatus = $state('ALL');
	let purchasePage = $state(1);
	let purchaseLimit = $state(10);
	let purchaseTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Hanya gudang utama (is_main === true) yang boleh menjadi tujuan
	 * penerimaan barang / purchasing.
	 */
	let mainWarehouses = $derived(logistik.warehouses.filter((w) => w.is_main));

	async function loadPurchases() {
		await logistik.fetchStockBatches({
			search: purchaseSearch,
			warehouse_id: purchaseWarehouse,
			status: purchaseStatus,
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
		warehouse_id: '',
		supplier_name: '',
		reference_number: '',
		notes: '',
		items: [] as {
			product_id: string;
			quantity: number;
			buy_price: number;
			batch_number: string;
			exp_date: string;
		}[]
	});

	function openRestock() {
		const firstProduct = productStore.products[0];
		// Gudang tujuan dibatasi pada gudang utama (is_main) saja.
		restockForm = {
			warehouse_id: mainWarehouses[0]?.id ?? '',
			supplier_name: '',
			reference_number: '',
			notes: '',
			items: [
				{
					product_id: firstProduct?.id ?? '',
					quantity: 0,
					buy_price: firstProduct?.buy_price ?? 0,
					batch_number: '',
					exp_date: ''
				}
			]
		};
		restockError = '';
		restockOpen = true;
	}

	function addRestockItem() {
		const firstProduct = productStore.products[0];
		restockForm.items = [
			...restockForm.items,
			{
				product_id: firstProduct?.id ?? '',
				quantity: 0,
				buy_price: firstProduct?.buy_price ?? 0,
				batch_number: '',
				exp_date: ''
			}
		];
		restockError = '';
	}

	function removeRestockItem(index: number) {
		if (restockForm.items.length <= 1) return;
		restockForm.items = restockForm.items.filter((_, itemIndex) => itemIndex !== index);
		restockError = '';
	}

	function onRestockProductChange(item: (typeof restockForm.items)[number]) {
		const product = productStore.products.find((p) => p.id === item.product_id);
		if (product) item.buy_price = product.buy_price;
	}

	async function submitRestock() {
		restockError = '';
		if (!restockForm.warehouse_id) {
			restockError = 'Gudang tujuan wajib dipilih.';
			return;
		}
		if (restockForm.items.length === 0) {
			restockError = 'Minimal satu barang harus ditambahkan.';
			return;
		}
		const invalidProductIndex = restockForm.items.findIndex((item) => !item.product_id);
		if (invalidProductIndex !== -1) {
			restockError = `Produk pada barang ke-${invalidProductIndex + 1} wajib dipilih.`;
			return;
		}
		const invalidQuantityIndex = restockForm.items.findIndex(
			(item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
		);
		if (invalidQuantityIndex !== -1) {
			restockError = `Kuantiti barang ke-${invalidQuantityIndex + 1} harus lebih dari 0.`;
			return;
		}
		try {
			await logistik.restockProduct({
				warehouse_id: restockForm.warehouse_id,
				supplier_name: restockForm.supplier_name,
				reference_number: restockForm.reference_number,
				notes: restockForm.notes,
				items: restockForm.items
			});
			toast.success(
				'Penerimaan dicatat',
				`${restockForm.items.length} barang berhasil ditambahkan ke gudang tujuan.`
			);
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
		try {
			await logistik.fetchStockRequests({
				search: requestSearch,
				status: requestStatus,
				page: requestPage,
				limit: requestLimit
			});
		} catch (err) {
			toast.error(
				'Gagal memuat permintaan',
				err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data requisition.'
			);
		}
	}

	function onRequestSearch() {
		clearTimeout(requestTimer);
		requestTimer = setTimeout(() => {
			requestPage = 1;
			loadRequests();
		}, 350);
	}

	let detailRequest = $state<StockRequest | null>(null);
	let approvalAllocations = $state<Record<string, StockBatchAllocation[]>>({});
	let approvalBatches = $state<StockBatch[]>([]);
	let isLoadingApprovalBatches = $state(false);
	let approvalError = $state('');
	let rejectOpen = $state(false);
	let rejectTargetId = $state<string | null>(null);
	let rejectError = $state('');
	let processingRequestId = $state<string | null>(null);

	async function openRequestDetail(request: StockRequest) {
		detailRequest = request;
		approvalAllocations = Object.fromEntries(
			request.items.map((item) => [
				item.id,
				(item.batch_allocations ??
					(item.stock_batch_id && (item.approved_qty ?? 0) > 0
						? [
								{
									stock_batch_id: item.stock_batch_id,
									quantity_approved: item.approved_qty ?? 0
								}
							]
						: [])
				).map((allocation) => ({ ...allocation }))
			])
		);
		approvalBatches = [];
		approvalError = '';
		if (!canUpdateApproval(request) && !canFulfill(request)) {
			isLoadingApprovalBatches = false;
			return;
		}
		isLoadingApprovalBatches = true;
		try {
			const batches = await logistik.fetchStockBatchesForRequest(request.from_warehouse_id);
			if (detailRequest?.id === request.id) approvalBatches = batches;
		} catch (err) {
			if (detailRequest?.id === request.id) {
				approvalError =
					err instanceof Error ? err.message : 'Gagal memuat batch stok untuk permintaan.';
				toast.error('Gagal memuat batch stok', approvalError);
			}
		} finally {
			if (detailRequest?.id === request.id) isLoadingApprovalBatches = false;
		}
	}

	function closeRequestDetail() {
		detailRequest = null;
		isLoadingApprovalBatches = false;
	}

	function batchesForRequestItem(item: StockRequest['items'][number]): StockBatch[] {
		return approvalBatches.filter((batch) => batch.product?.id === item.product_id);
	}

	function allocationsForRequestItem(item: StockRequest['items'][number]): StockBatchAllocation[] {
		return approvalAllocations[item.id] ?? [];
	}

	function approvedQuantityForItem(item: StockRequest['items'][number]): number {
		return allocationsForRequestItem(item).reduce(
			(total, allocation) => total + allocation.quantity_approved,
			0
		);
	}

	function quantityForBatch(itemId: string, batchId: string): number {
		return (
			approvalAllocations[itemId]?.find((allocation) => allocation.stock_batch_id === batchId)
				?.quantity_approved ?? 0
		);
	}

	function setBatchAllocation(itemId: string, batchId: string, quantity: number) {
		const allocations = approvalAllocations[itemId] ?? [];
		const existingAllocation = allocations.find(
			(allocation) => allocation.stock_batch_id === batchId
		);
		approvalAllocations[itemId] =
			quantity > 0
				? existingAllocation
					? allocations.map((allocation) =>
							allocation.stock_batch_id === batchId
								? { ...allocation, quantity_approved: quantity }
								: allocation
						)
					: [...allocations, { stock_batch_id: batchId, quantity_approved: quantity }]
				: allocations.filter((allocation) => allocation.stock_batch_id !== batchId);
	}

	async function saveRequestApproval(request: StockRequest, status: 'APPROVED' | 'PARTIAL') {
		approvalError = '';
		if (request.items.length === 0) {
			approvalError = 'Permintaan tanpa item tidak dapat disetujui atau ditolak.';
			return;
		}
		if (status === 'APPROVED') {
			window.alert(
				'Pastikan total alokasi kuantiti dari batch untuk setiap produk sama dengan kuantiti yang diminta.'
			);
			if (!window.confirm(`Lanjutkan Setujui Penuh untuk permintaan ${request.no_trx}?`)) return;
		}
		const invalidItem = request.items.find((item) => {
			const allocations = allocationsForRequestItem(item);
			const quantity = approvedQuantityForItem(item);
			const minimum = item.approved_qty ?? 0;
			if (
				allocations.some(
					(allocation) =>
						!Number.isInteger(allocation.quantity_approved) ||
						allocation.quantity_approved <= 0 ||
						!allocation.stock_batch_id
				)
			) {
				return true;
			}
			return (
				!Number.isFinite(quantity) ||
				!Number.isInteger(quantity) ||
				(status === 'APPROVED' && quantity !== item.requested_qty) ||
				(status === 'PARTIAL' && quantity <= 0) ||
				(status === 'PARTIAL' && quantity < minimum) ||
				quantity > item.requested_qty ||
				allocations.length === 0
			);
		});
		if (invalidItem) {
			approvalError =
				status === 'APPROVED'
					? 'Total kuantiti dari batch yang dipilih harus sama persis dengan kuantiti permintaan pada setiap produk.'
					: 'Total alokasi harus lebih dari 0, tidak kurang dari jumlah yang sudah disetujui, dan tidak melebihi kuantiti permintaan.';
			return;
		}
		const allocatedByBatch = new Map<string, number>();
		let invalidBatchAllocation = false;
		for (const item of request.items) {
			for (const allocation of allocationsForRequestItem(item)) {
				const batch = batchesForRequestItem(item).find(
					(candidate) => candidate.id === allocation.stock_batch_id
				);
				if (!batch) {
					invalidBatchAllocation = true;
					break;
				}
				const allocated =
					(allocatedByBatch.get(batch.id) ?? 0) + allocation.quantity_approved;
				allocatedByBatch.set(batch.id, allocated);
				if (batch.current_stock < allocated) {
					invalidBatchAllocation = true;
					break;
				}
			}
			if (invalidBatchAllocation) break;
		}
		if (invalidBatchAllocation) {
			approvalError =
				'Pastikan setiap alokasi menggunakan batch yang tersedia dan total alokasi tiap batch tidak melebihi stoknya.';
			return;
		}
		if (
			status === 'PARTIAL' &&
			request.items.every((item) => approvedQuantityForItem(item) === item.requested_qty)
		) {
			approvalError = 'Semua kuantiti sudah penuh. Gunakan tombol Setujui Penuh.';
			return;
		}

		processingRequestId = request.id;
		try {
			const updatedRequest = await logistik.updateStockRequest(
				request.id,
				status,
				approvalAllocations
			);
			detailRequest = {
				...updatedRequest,
				items: updatedRequest.items.map((item) => ({
					...item,
					approved_qty: approvedQuantityForItem(item),
					batch_allocations: allocationsForRequestItem(item)
				}))
			};
			toast.success(
				updatedRequest.status === 'PARTIAL'
					? 'Permintaan disetujui sebagian'
					: 'Permintaan disetujui',
				`${request.no_trx} berhasil diperbarui.`
			);
			await loadRequests();
			await loadOverview();
		} catch (err: any) {
			approvalError = err?.message ?? 'Gagal menyimpan persetujuan.';
			toast.error('Gagal menyetujui', approvalError);
			await loadRequests();
		} finally {
			processingRequestId = null;
		}
	}

	function openReject(request: StockRequest) {
		detailRequest = null;
		rejectTargetId = request.id;
		rejectError = '';
		rejectOpen = true;
	}

	async function submitReject() {
		rejectError = '';
		if (!rejectTargetId) return;
		processingRequestId = rejectTargetId;
		try {
			await logistik.updateStockRequest(rejectTargetId, 'REJECTED', {});
			toast.success('Permintaan ditolak', 'Permintaan telah ditolak.');
			rejectOpen = false;
			await loadRequests();
			await loadOverview();
		} catch (err: any) {
			rejectError = err?.message ?? 'Gagal menolak permintaan.';
			toast.error('Gagal menolak', rejectError);
			await loadRequests();
		} finally {
			processingRequestId = null;
		}
	}

	async function fulfillRequest(request: StockRequest) {
		if (!confirm(`Proses distribusi untuk ${request.no_trx}?`)) return;
		processingRequestId = request.id;
		try {
			await logistik.updateStockRequest(request.id, 'SHIPPED', approvalAllocations);
			toast.success('Barang dikirim', `${request.no_trx} telah dikirim ke unit tujuan.`);
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
				loadWarehousesAndPurchases();
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

	async function loadWarehousesAndPurchases() {
		// Pastikan daftar warehouse (khususnya gudang utama) terbaru sebelum
		// membuka menu Penerimaan Barang.
		await logistik.fetchWarehouses();
		await loadPurchases();
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

	function canUpdateApproval(request: StockRequest): boolean {
		return request.status === 'PENDING' || request.status === 'PARTIAL';
	}

	function canReject(request: StockRequest): boolean {
		return canUpdateApproval(request);
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
									{formatNumber(lowStockProducts.length)}
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
										{lowStockProducts.length} item
									</span>
								</div>
								{#if lowStockProducts.length === 0}
									<EmptyState
										icon="✅"
										title="Semua stok aman"
										description="Tidak ada produk di bawah batas minimum."
									/>
								{:else}
									<div class="space-y-3">
										{#each lowStockProducts.slice(0, 5) as product (product.id)}
											<div
												class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
											>
												<div class="min-w-0">
													<p class="truncate text-sm font-bold text-slate-800">
														{product.name}
													</p>
													<p class="text-xs text-slate-400">
														{CATALOG_CATEGORY_LABELS[product.category]} · min {formatNumber(
															product.min_stock
														)}{product.unit ? ` ${product.unit}` : ''}
													</p>
												</div>
												<div class="ml-3 shrink-0 text-right">
													<p class="text-sm font-black text-amber-600">
														{formatNumber(product.stock)}
													</p>
													<p class="text-[11px] text-slate-400">
														kurang {formatNumber(Math.max(0, product.min_stock - product.stock))}
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
									Catat penerimaan stok dari supplier ke gudang utama dan pantau kondisi setiap batch.
								</p>
							</div>
							<button
								onclick={openRestock}
								class="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-90"
							>
								📥 Catat Penerimaan
							</button>
						</div>

						<!-- Info cards dari summary backend -->
						<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
							<div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">Total Batch</p>
								<p class="mt-2 text-2xl font-black text-slate-900">
									{formatNumber(logistik.purchaseSummary?.total_batches ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-slate-400">Batch stok tercatat</p>
							</div>
							<div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-slate-400 uppercase">
									Total Stok Awal
								</p>
								<p class="mt-2 text-2xl font-black text-slate-900">
									{formatNumber(logistik.purchaseSummary?.total_initial_stock ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-slate-400">Akumulasi kuantiti masuk</p>
							</div>
							<div class="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-emerald-600 uppercase">
									Total Stok Saat Ini
								</p>
								<p class="mt-2 text-2xl font-black text-emerald-700">
									{formatNumber(logistik.purchaseSummary?.total_current_stock ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-emerald-500">Sisa stok seluruh batch</p>
							</div>
							<div class="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-amber-600 uppercase">
									Hampir Kedaluwarsa
								</p>
								<p class="mt-2 text-2xl font-black text-amber-700">
									{formatNumber(logistik.purchaseSummary?.total_near_expiry_batches ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-amber-500">ED dalam 90 hari</p>
							</div>
							<div class="rounded-[24px] border border-red-200 bg-red-50 p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-red-600 uppercase">Kedaluwarsa</p>
								<p class="mt-2 text-2xl font-black text-red-700">
									{formatNumber(logistik.purchaseSummary?.total_expired_batches ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-red-500">Batch melewati ED</p>
							</div>
							<div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
								<p class="text-xs font-bold tracking-wider text-slate-500 uppercase">Batch Kosong</p>
								<p class="mt-2 text-2xl font-black text-slate-700">
									{formatNumber(logistik.purchaseSummary?.total_empty_batches ?? 0)}
								</p>
								<p class="mt-1 text-xs font-medium text-slate-400">Stok habis</p>
							</div>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white">
							<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
								<input
									type="search"
									placeholder="Cari produk, no. batch, atau gudang…"
									class="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={purchaseSearch}
									oninput={onPurchaseSearch}
								/>
								<select
									class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={purchaseWarehouse}
									onchange={() => {
										purchasePage = 1;
										loadPurchases();
									}}
								>
									<option value="ALL">Semua gudang</option>
									{#each logistik.warehouses as w (w.id)}
										<option value={w.id}>{w.name}</option>
									{/each}
								</select>
								<select
									class="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
									bind:value={purchaseStatus}
									onchange={() => {
										purchasePage = 1;
										loadPurchases();
									}}
								>
									<option value="ALL">Semua status</option>
									{#each Object.entries(STOCK_BATCH_STATUS_LABELS) as [value, label] (value)}
										<option value={value}>{label}</option>
									{/each}
								</select>
							</div>

							{#if logistik.isLoadingPurchases}
								<TableSkeleton rows={6} cols={9} />
							{:else if logistik.purchaseRows.length === 0}
								<EmptyState
									icon="📥"
									title="Belum ada batch stok"
									description="Catat penerimaan barang untuk melihat daftar batch stok."
								/>
							{:else}
								<div class="overflow-x-auto">
									<table class="w-full text-sm">
										<thead>
											<tr
												class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"
											>
												<th class="px-4 py-2.5 font-medium">Produk</th>
												<th class="px-4 py-2.5 font-medium">Gudang</th>
												<th class="px-4 py-2.5 font-medium">No. Batch</th>
												<th class="px-4 py-2.5 font-medium">Kedaluwarsa</th>
												<th class="px-4 py-2.5 text-right font-medium">Harga Beli</th>
												<th class="px-4 py-2.5 text-right font-medium">Stok Awal</th>
												<th class="px-4 py-2.5 text-right font-medium">Stok Saat Ini</th>
												<th class="px-4 py-2.5 font-medium">Sisa</th>
												<th class="px-4 py-2.5 font-medium">Status</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each logistik.purchaseRows as batch (batch.id)}
												<tr class="hover:bg-slate-50">
													<td class="px-4 py-3">
														<p class="font-medium text-slate-800">
															{batch.product?.name ?? '-'}
														</p>
														<p class="text-xs text-slate-400">
															{batch.product?.code ?? '-'}{batch.product?.unit
																? ` · ${batch.product.unit}`
																: ''}
														</p>
													</td>
													<td class="px-4 py-3">
														<p class="text-slate-600">{batch.warehouse?.name ?? '-'}</p>
														{#if batch.warehouse}
															<p class="text-xs text-slate-400">
																{WAREHOUSE_TYPE_LABELS[batch.warehouse.type]}
															</p>
														{/if}
													</td>
													<td class="px-4 py-3 font-mono text-xs text-slate-600">
														{batch.batch_number ?? '-'}
													</td>
													<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
														{batch.exp_date ? formatDateTime(batch.exp_date) : '-'}
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{rupiah(batch.buy_price)}
													</td>
													<td class="px-4 py-3 text-right text-slate-600">
														{formatNumber(batch.initial_stock)}
													</td>
													<td class="px-4 py-3 text-right font-medium text-slate-800">
														{formatNumber(batch.current_stock)}
													</td>
													<td class="px-4 py-3">
														<div class="flex items-center gap-2">
															<div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
																<div
																	class="h-full rounded-full {batch.remaining_percentage < 25
																		? 'bg-red-500'
																		: batch.remaining_percentage < 60
																			? 'bg-amber-500'
																			: 'bg-emerald-500'}"
																	style={`width: ${Math.max(
																		0,
																		Math.min(100, batch.remaining_percentage)
																	)}%`}
																></div>
															</div>
															<span class="text-xs font-medium text-slate-600">
																{batch.remaining_percentage}%
															</span>
														</div>
													</td>
													<td class="px-4 py-3">
														<Badge variant={STOCK_BATCH_STATUS_VARIANTS[batch.status]}>
															{STOCK_BATCH_STATUS_LABELS[batch.status]}
														</Badge>
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
									label="batch"
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
								{logistik.pendingRequestCount} Menunggu di halaman ini
							</span>
						</div>

						<div class="rounded-xl border border-slate-200 bg-white">
							<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
								<input
									type="search"
									placeholder="Cari no. permintaan, catatan, nama produk, atau kode…"
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
							{:else if logistik.requestError}
								<div class="p-6 text-center">
									<p class="text-sm font-semibold text-red-700">Gagal memuat data requisition</p>
									<p class="mt-1 text-xs text-red-600">{logistik.requestError}</p>
									<button
										type="button"
										class="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
										onclick={loadRequests}
									>
										Coba lagi
									</button>
								</div>
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
															onclick={() => openRequestDetail(request)}
														>
															{request.no_trx}
														</button>
													</td>
													<td class="px-4 py-3">
														<p class="font-medium text-slate-800">{request.requester}</p>
														<p class="text-xs text-slate-400">{request.unit_name}</p>
													</td>
													<td class="px-4 py-3 text-xs text-slate-500">
														<p>
															{request.from_warehouse_name ??
																logistik.warehouseById(request.from_warehouse_id)?.name ??
																'-'}
														</p>
														<p class="text-slate-300">↓</p>
														<p>
															{request.to_warehouse_name ??
																logistik.warehouseById(request.to_warehouse_id)?.name ??
																'-'}
														</p>
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
															<button
																type="button"
																class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
																onclick={() => openRequestDetail(request)}
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
	description="Input satu atau beberapa barang dari supplier yang sama ke gudang utama."
	size="lg"
	onclose={() => (restockOpen = false)}
>
	{#if restockError}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
			{restockError}
		</div>
	{/if}

	<div class="grid gap-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block">
				<span class="text-xs font-medium text-slate-600">Supplier</span>
				<input
					bind:value={restockForm.supplier_name}
					placeholder="PT Kimia Farma Trading"
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
				/>
			</label>
			<label class="block">
				<span class="text-xs font-medium text-slate-600">No. Referensi (PO/Surat Jalan)</span>
				<input
					bind:value={restockForm.reference_number}
					placeholder="PO-2024-0091"
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

		<label class="block">
			<span class="text-xs font-medium text-slate-600">Gudang Tujuan *</span>
			<select
				bind:value={restockForm.warehouse_id}
				class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
			>
				{#if mainWarehouses.length === 0}
					<option value="" disabled>Belum ada gudang utama</option>
				{:else}
					{#each mainWarehouses as warehouse (warehouse.id)}
						<option value={warehouse.id}>
							{warehouse.name} · {WAREHOUSE_TYPE_LABELS[warehouse.type]}
						</option>
					{/each}
				{/if}
			</select>
			<span class="mt-1 block text-[11px] text-slate-400">
				Hanya gudang utama (is_main) yang dapat dijadikan tujuan penerimaan/purchasing.
			</span>
		</label>

		<div class="space-y-3 border-t border-slate-100 pt-4">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h3 class="text-sm font-semibold text-slate-800">Daftar Barang</h3>
					<p class="mt-0.5 text-xs text-slate-500">
						Setiap barang dapat memiliki kuantiti, harga, dan batch berbeda.
					</p>
				</div>
				<button
					type="button"
					class="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
					onclick={addRestockItem}
				>
					+ Tambah Barang
				</button>
			</div>

			{#each restockForm.items as item, index (index)}
				<div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-xs font-semibold text-slate-700">Barang {index + 1}</p>
						<button
							type="button"
							class="text-xs font-medium text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
							disabled={restockForm.items.length <= 1}
							onclick={() => removeRestockItem(index)}
						>
							Hapus
						</button>
					</div>

					<label class="block">
						<span class="text-xs font-medium text-slate-600">Produk *</span>
						<select
							bind:value={item.product_id}
							onchange={() => onRestockProductChange(item)}
							class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
						>
							{#each productStore.products as product (product.id)}
								<option value={product.id}>{product.name} ({product.code})</option>
							{/each}
						</select>
					</label>

					<div class="grid gap-3 sm:grid-cols-2">
						<label class="block">
							<span class="text-xs font-medium text-slate-600">Kuantiti Masuk *</span>
							<input
								type="number"
								min="1"
								bind:value={item.quantity}
								class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
							/>
						</label>
						<label class="block">
							<span class="text-xs font-medium text-slate-600">Harga Beli Satuan</span>
							<input
								type="number"
								min="0"
								bind:value={item.buy_price}
								class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
							/>
						</label>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<label class="block">
							<span class="text-xs font-medium text-slate-600">No. Batch</span>
							<input
								bind:value={item.batch_number}
								placeholder="B2401-01"
								class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
							/>
						</label>
						<label class="block">
							<span class="text-xs font-medium text-slate-600">Kedaluwarsa (Exp. Date)</span>
							<input
								type="date"
								bind:value={item.exp_date}
								class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
							/>
						</label>
					</div>
				</div>
			{/each}
		</div>
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
	description="Periksa kuantiti yang disetujui dan pilih batch stok gudang asal untuk setiap barang."
	size="lg"
	onclose={closeRequestDetail}
>
	{#if detailRequest}
		<div class="space-y-4">
			{#if approvalError}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
					{approvalError}
				</div>
			{/if}

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
						{detailRequest.from_warehouse_name ??
							logistik.warehouseById(detailRequest.from_warehouse_id)?.name ??
							'-'}
					</p>
				</div>
				<div class="rounded-lg bg-slate-50 px-4 py-3">
					<p class="text-[10px] font-bold text-slate-400 uppercase">Gudang Tujuan</p>
					<p class="text-sm text-slate-700">
						{detailRequest.to_warehouse_name ??
							logistik.warehouseById(detailRequest.to_warehouse_id)?.name ??
							'-'}
					</p>
				</div>
			</div>

			{#if detailRequest.notes}
				<p class="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
					{detailRequest.notes}
				</p>
			{/if}

			{#if canUpdateApproval(detailRequest)}
				<p class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
					Alokasikan kuantiti yang akan disetujui pada satu atau beberapa batch untuk setiap produk.
					Total alokasi harus sesuai dengan status persetujuan yang dipilih.
				</p>
			{/if}

			<div class="overflow-hidden rounded-lg border border-slate-200">
				<table class="w-full text-sm">
					<thead class="bg-slate-50 text-xs uppercase text-slate-500">
						<tr>
							<th class="px-3 py-2 text-left font-medium">Produk &amp; Alokasi Batch</th>
							<th class="px-3 py-2 text-right font-medium">Diminta</th>
							<th class="px-3 py-2 text-right font-medium">Total Disetujui</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each detailRequest.items as item (item.id)}
							<tr>
								<td class="px-3 py-3">
									<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
										<div>
											<p class="font-semibold text-slate-800">
												{item.product_name ?? logistik.productById(item.product_id)?.name ?? '-'}
												{#if item.product_code}
													<span class="ml-1 text-xs font-normal text-slate-400">
														({item.product_code})
													</span>
												{/if}
											</p>
										</div>
										<p class="text-xs font-semibold text-sky-700">
											Total alokasi: {formatNumber(approvedQuantityForItem(item))}
											{item.unit ?? logistik.productById(item.product_id)?.unit ?? ''}
										</p>
									</div>

									{#if canUpdateApproval(detailRequest)}
										{#if isLoadingApprovalBatches}
											<p class="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
												Memuat batch stok…
											</p>
										{:else if batchesForRequestItem(item).length === 0}
											<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
												Tidak ada batch produk ini yang tersedia di gudang asal.
											</p>
										{:else}
											<div class="grid gap-2 sm:grid-cols-2">
												{#each batchesForRequestItem(item) as batch (batch.id)}
													<label
														class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
													>
														<span class="min-w-0">
															<span class="block truncate text-xs font-semibold text-slate-800">
																{batch.batch_number}
															</span>
															<span class="mt-0.5 block text-[11px] text-slate-500">
																Stok {formatNumber(batch.current_stock)} · ED
																{batch.exp_date ? formatDateTime(batch.exp_date) : '-'}
															</span>
														</span>
														<span class="shrink-0 text-right">
															<span class="block text-[10px] font-medium text-slate-500">
																Alokasi
															</span>
															<input
																type="number"
																min="0"
																max={batch.current_stock}
																step="1"
																aria-label={`Kuantiti alokasi batch ${batch.batch_number} untuk ${item.product_name ?? 'produk'}`}
																value={quantityForBatch(item.id, batch.id) || ''}
																oninput={(event) =>
																	setBatchAllocation(
																		item.id,
																		batch.id,
																		Number(event.currentTarget.value) || 0
																	)}
																class="mt-1 w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-sky-500"
															/>
														</span>
													</label>
												{/each}
											</div>
										{/if}
									{:else}
										<div class="grid gap-2 sm:grid-cols-2">
											{#each allocationsForRequestItem(item) as allocation (allocation.stock_batch_id)}
												{@const batch = approvalBatches.find(
													(row) => row.id === allocation.stock_batch_id
												)}
												<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
													<p class="font-semibold text-slate-800">
														{batch?.batch_number ?? allocation.stock_batch_id}
													</p>
													<p class="mt-0.5 text-slate-500">
														Alokasi {formatNumber(allocation.quantity_approved)}
														{item.unit ?? logistik.productById(item.product_id)?.unit ?? ''}
													</p>
												</div>
											{:else}
												<p class="text-xs text-slate-400">Belum ada alokasi batch.</p>
											{/each}
										</div>
									{/if}
								</td>
								<td class="whitespace-nowrap px-3 py-3 text-right text-slate-600">
									{formatNumber(item.requested_qty)}
								</td>
								<td class="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800">
									{#if item.approved_qty === null && !canUpdateApproval(detailRequest)}
										-
									{:else}
										{formatNumber(approvedQuantityForItem(item))}
									{/if}
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
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
			onclick={closeRequestDetail}
		>
			Tutup
		</button>
		{#if detailRequest && canUpdateApproval(detailRequest)}
			{#if canReject(detailRequest)}
				<button
					type="button"
					disabled={processingRequestId === detailRequest.id}
					class="rounded-lg bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
					onclick={() => openReject(detailRequest!)}
				>
					Tolak
				</button>
			{/if}
			<button
				type="button"
				disabled={processingRequestId === detailRequest.id || logistik.isSubmitting || isLoadingApprovalBatches}
				class="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
				onclick={() => saveRequestApproval(detailRequest!, 'PARTIAL')}
			>
				Setujui Sebagian
			</button>
			<button
				type="button"
				disabled={processingRequestId === detailRequest.id || logistik.isSubmitting || isLoadingApprovalBatches}
				class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
				onclick={() => saveRequestApproval(detailRequest!, 'APPROVED')}
			>
				Setujui Penuh
			</button>
			{#if detailRequest.status === 'PARTIAL'}
				<button
					type="button"
					disabled={processingRequestId === detailRequest.id || logistik.isSubmitting}
					class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
					onclick={() => fulfillRequest(detailRequest!)}
				>
					Kirim Barang
				</button>
			{/if}
		{:else if detailRequest && canFulfill(detailRequest)}
			<button
				type="button"
				disabled={processingRequestId === detailRequest.id || logistik.isSubmitting}
				class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
				onclick={() => fulfillRequest(detailRequest!)}
			>
				Kirim Barang
			</button>
		{/if}
	{/snippet}
</Modal>

<!-- ================================================================== -->
<!-- MODAL: Tolak permintaan                                             -->
<!-- ================================================================== -->
<Modal
	open={rejectOpen}
	title="Tolak Permintaan"
	description="Konfirmasi penolakan permintaan ini. Statusnya akan diubah menjadi Ditolak."
	size="md"
	onclose={() => (rejectOpen = false)}
>
	{#if rejectError}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
			{rejectError}
		</div>
	{/if}

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
			disabled={logistik.isSubmitting || processingRequestId === rejectTargetId}
			onclick={submitReject}
		>
			{logistik.isSubmitting || processingRequestId === rejectTargetId
				? 'Memproses…'
				: 'Tolak Permintaan'}
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
					placeholder="Contoh: selisih hasil opname, barang rusak, kadaluwarsa, dsb."></textarea>
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
