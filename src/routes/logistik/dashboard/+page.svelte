<script lang="ts">
	import { onMount } from 'svelte';
	import {
		logistik,
		PRODUCT_CATEGORY_LABELS,
		PRODUCT_CATEGORY_OPTIONS,
		INVENTORY_LOG_TYPE_LABELS,
		INVENTORY_LOG_TYPE_VARIANTS,
		type InventoryLogType,
		type Product
	} from '$lib/stores/logistik.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatDateTime, formatNumber, formatSigned } from '$lib/utils/format';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import TableSkeleton from '$lib/components/ui/TableSkeleton.svelte';

	let tab = $state<'stok' | 'audit'>('stok');

	/* Matriks stok */
	let stockSearch = $state('');
	let stockCategory = $state('ALL');
	let stockWarehouse = $state('ALL');
	let stockTimer: ReturnType<typeof setTimeout> | undefined;

	/* Audit trail */
	let logSearch = $state('');
	let logType = $state('ALL');
	let logWarehouse = $state('ALL');
	let logPage = $state(1);
	let logLimit = $state(10);
	let logTimer: ReturnType<typeof setTimeout> | undefined;

	/* Adjustment */
	let adjustOpen = $state(false);
	let adjustTarget = $state<Product | null>(null);
	let adjustWarehouse = $state('');
	let adjustNewStock = $state(0);
	let adjustReason = $state('');
	let adjustError = $state('');

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

	onMount(() => {
		loadStock();
		loadLogs();
	});

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
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-semibold text-slate-900">Monitoring &amp; Audit Stok Global</h2>
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
				<EmptyState icon="🔍" title="Tidak ada produk" description="Ubah filter untuk melihat data stok." />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
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
											{row.product.code} · {PRODUCT_CATEGORY_LABELS[row.product.category]}
										</p>
									</td>
									{#each row.cells as cell (cell.warehouse.id)}
										<td class="px-4 py-3 text-right {cell.is_low ? 'font-medium text-amber-600' : 'text-slate-600'}">
											{formatNumber(cell.stock)}
										</td>
									{/each}
									<td class="px-4 py-3 text-right font-semibold text-slate-800">{formatNumber(row.total)}</td>
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
				<EmptyState icon="🗂️" title="Tidak ada mutasi" description="Belum ada aktivitas stok yang cocok dengan filter." />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
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
									<td class="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(log.createdAt)}</td>
									<td class="px-4 py-3 text-slate-700">{logistik.productById(log.product_id)?.name ?? '-'}</td>
									<td class="px-4 py-3 text-slate-600">{logistik.warehouseById(log.warehouse_id)?.name ?? '-'}</td>
									<td class="px-4 py-3">
										<Badge variant={INVENTORY_LOG_TYPE_VARIANTS[log.type]}>
											{INVENTORY_LOG_TYPE_LABELS[log.type]}
										</Badge>
									</td>
									<td class="px-4 py-3 text-right font-medium {log.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}">
										{formatSigned(log.quantity)}
									</td>
									<td class="px-4 py-3 text-right text-slate-700">{formatNumber(log.balance_after)}</td>
									<td class="px-4 py-3">
										<p class="font-mono text-xs text-slate-600">{log.reference ?? '-'}</p>
										{#if log.notes}<p class="text-xs text-slate-400">{log.notes}</p>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<Pagination
					meta={logistik.logMeta}
					onpage={(p) => {
						logPage = p;
						loadLogs();
					}}
					label="mutasi"
				/>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal stock adjustment / opname -->
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
					class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
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
