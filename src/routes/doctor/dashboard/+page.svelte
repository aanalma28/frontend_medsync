<script lang="ts">
	let selectedPatient = $state('Ayu Putri');
	let diagnosis = $state('Demam dan batuk ringan');
	let searchQuery = $state('');
	let selectedMedicines = $state<Array<{ name: string; usage: string }>>([]);
	let receiptVisible = $state(false);
	let printMode = $state(false);

	const medicineCatalog = [
		{
			name: 'Paracetamol 500mg',
			stock: 42,
			category: 'Analgesik',
			availability: 'Tersedia',
			alternative: 'Ibuprofen 400mg',
			notes: 'Cocok untuk penurun demam'
		},
		{
			name: 'Amoxicillin 500mg',
			stock: 18,
			category: 'Antibiotik',
			availability: 'Tersedia',
			alternative: 'Cefixime 200mg',
			notes: 'Untuk infeksi ringan sampai sedang'
		},
		{
			name: 'Omeprazole 20mg',
			stock: 7,
			category: 'Pencernaan',
			availability: 'Stok menipis',
			alternative: 'Pantoprazole 20mg',
			notes: 'Untuk asam lambung dan maag'
		},
		{
			name: 'Metformin 500mg',
			stock: 31,
			category: 'Diabetes',
			availability: 'Tersedia',
			alternative: 'Glimepiride 2mg',
			notes: 'Untuk pengendalian gula darah'
		}
	];

	let filteredMedicines = $derived(
		medicineCatalog.filter((medicine) => {
			const query = searchQuery.toLowerCase();
			return (
				medicine.name.toLowerCase().includes(query) ||
				medicine.category.toLowerCase().includes(query) ||
				medicine.alternative.toLowerCase().includes(query)
			);
		})
	);

	function toggleMedicine(name: string) {
		const existing = selectedMedicines.find((item) => item.name === name);
		if (existing) {
			selectedMedicines = selectedMedicines.filter((item) => item.name !== name);
		} else {
			selectedMedicines = [...selectedMedicines, { name, usage: '' }];
		}
	}

	function updateMedicineUsage(name: string, usage: string) {
		selectedMedicines = selectedMedicines.map((item) =>
			item.name === name ? { ...item, usage } : item
		);
	}

	function reserveMedicines() {
		receiptVisible = true;
		printMode = false;
	}

	function printReceipt() {
		receiptVisible = true;
		printMode = true;
		setTimeout(() => {
			window.print();
		}, 120);
	}
</script>

<style>
	.receipt-print-card {
		font-family: 'Courier New', Courier, monospace;
		letter-spacing: 0.02em;
		line-height: 1.4;
		font-size: 12px;
		color: #0f172a;
	}

	.receipt-print-card p,
	.receipt-print-card li,
	.receipt-print-card span {
		font-family: 'Courier New', Courier, monospace;
	}

	.receipt-print-divider {
		border-top: 1px dashed #cbd5e1;
	}

	.receipt-print-line-item {
		border-bottom: 1px dashed #e2e8f0;
		padding-bottom: 0.35rem;
		margin-bottom: 0.35rem;
	}

	.receipt-print-stamp {
		border: 1px dashed #34d399;
		background: #ecfdf5;
	}

	.receipt-print-signature {
		border-top: 1px solid #cbd5e1;
	}

	.receipt-print-footer {
		border-top: 1px dashed #cbd5e1;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
	}

	@media print {
		@page {
			size: 80mm auto;
			margin: 0;
		}

		:global(body) {
			background: #ffffff !important;
			margin: 0;
			padding: 0;
			width: 80mm;
		}

		:global(body *) {
			visibility: hidden;
		}

		.receipt-print-shell,
		.receipt-print-shell * {
			visibility: visible;
		}

		.receipt-print-shell {
			position: absolute;
			left: 0;
			top: 0;
			width: 80mm;
			max-width: 80mm;
			margin: 0;
			padding: 0;
			background: #ffffff;
			box-shadow: none;
			border: none;
		}

		.receipt-print-card {
			width: 80mm;
			max-width: 80mm;
			margin: 0 auto;
			border: none;
			box-shadow: none;
			break-inside: avoid;
			page-break-inside: avoid;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>

<svelte:head>
	<title>Dashboard Dokter | MedSync</title>
</svelte:head>

<div class="min-h-screen bg-[linear-gradient(90deg,_#f3f9ff_0%,_#eef6ff_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
		<header class="rounded-[24px] border border-sky-200 bg-gradient-to-r from-sky-900 to-cyan-700 p-4 text-white shadow-[0_20px_60px_-35px_rgba(2,132,199,0.5)] backdrop-blur sm:rounded-[28px] sm:p-6">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="min-w-0">
					<p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100 sm:text-sm">Dashboard Dokter</p>
					<h1 class="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-3xl">
						Kelola resep, stok obat, dan struk pasien
					</h1>
				</div>
				<div class="rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-sky-50 sm:px-4 sm:py-3">
					<span class="font-semibold">Hari ini</span> • 08:30 WIB • RS Medika Sehat
				</div>
			</div>
		</header>

		<section class="grid gap-3 sm:grid-cols-3 sm:gap-4">
			<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Pasien hari ini</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">24</p>
			</div>
			<div class="rounded-2xl border border-sky-200 bg-cyan-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Obat tersedia</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">128</p>
			</div>
			<div class="rounded-2xl border border-sky-200 bg-sky-100 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Reservasi menunggu</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">5</p>
			</div>
		</section>

		<div class="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
			<section class="rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6 lg:p-7">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div class="min-w-0">
						<p class="text-sm font-semibold text-sky-700">Buat resep / reservasi obat</p>
						<h2 class="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Form resep dokter</h2>
					</div>
					<button class="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 sm:w-auto">
						Cetak format resep
					</button>
				</div>

				<form
					class="mt-6 space-y-4"
					onsubmit={(event) => {
						event.preventDefault();
						reserveMedicines();
					}}
				>
					<div class="grid gap-4 md:grid-cols-2">
						<label class="block text-sm font-medium text-slate-700">
							<span class="mb-2 block">Nama pasien</span>
							<input bind:value={selectedPatient} class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
						</label>
						<label class="block text-sm font-medium text-slate-700">
							<span class="mb-2 block">Diagnosa</span>
							<input bind:value={diagnosis} class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
						</label>
					</div>

					<label class="block text-sm font-medium text-slate-700">
						<span class="mb-2 block">Cari obat</span>
						<input bind:value={searchQuery} class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Cari obat, kategori, atau alternatif" />
					</label>

					<div class="space-y-3">
						{#each filteredMedicines as medicine (medicine.name)}
							<div
								class={`flex w-full flex-col rounded-2xl border p-4 text-left transition ${selectedMedicines.some((item) => item.name === medicine.name) ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300'}`}
								role="group"
							>
								<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div class="min-w-0">
										<p class="break-words font-semibold text-slate-900">{medicine.name}</p>
										<p class="mt-1 text-sm text-slate-500">{medicine.category}</p>
									</div>
									<div class="flex items-center gap-2">
										<span class={`rounded-full px-3 py-1 text-xs font-semibold ${medicine.availability === 'Tersedia' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
											{medicine.availability}
										</span>
										<button
												type="button"
												class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
												onclick={(event) => {
													event.stopPropagation();
													toggleMedicine(medicine.name);
												}}
										>
											{selectedMedicines.some((item) => item.name === medicine.name) ? 'Batalkan' : 'Pilih'}
										</button>
									</div>
								</div>
								<div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
									<span class="rounded-full bg-slate-100 px-2.5 py-1">Stok: {medicine.stock}</span>
									<span class="rounded-full bg-slate-100 px-2.5 py-1">Alternatif: {medicine.alternative}</span>
								</div>
								<p class="mt-3 text-sm leading-6 text-slate-500">{medicine.notes}</p>
								{#if selectedMedicines.some((item) => item.name === medicine.name)}
									<label class="mt-3 block text-sm font-medium text-slate-700">
										<span class="mb-2 block">Pemakaian obat</span>
										<input
											class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
											placeholder="Contoh: 1× sehari setelah makan"
											value={selectedMedicines.find((item) => item.name === medicine.name)?.usage ?? ''}
											oninput={(event) => {
												event.stopPropagation();
												updateMedicineUsage(medicine.name, event.currentTarget.value);
											}}
										/>
									</label>
								{/if}
							</div>
						{/each}
					</div>

					<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
						<button type="submit" class="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-95 sm:w-auto">
							Reservasi obat & buat struk
						</button>
						<button type="button" class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto">
							Simpan draft
						</button>
					</div>
				</form>
			</section>

			<aside class="space-y-4">
				<div class="rounded-[24px] border border-sky-200 bg-sky-50 p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-5">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<p class="text-sm font-semibold text-sky-700">Ringkasan resep</p>
							<h3 class="mt-1 text-lg font-semibold text-slate-900">{selectedPatient}</h3>
						</div>
						<span class="inline-flex w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Draft</span>
					</div>

					<div class="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
						<p><span class="font-semibold text-slate-900">Diagnosa:</span> {diagnosis}</p>
						<p>
							<span class="font-semibold text-slate-900">Obat dipilih:</span>
							{selectedMedicines.length > 0
								? selectedMedicines
										.map((item) => `${item.name}${item.usage ? ` — ${item.usage}` : ''}`)
										.join(', ')
								: 'Belum ada obat yang dipilih'}
						</p>
					</div>
				</div>

				<div class="rounded-[24px] border border-sky-200 bg-slate-950 p-4 text-white shadow-[0_16px_44px_-32px_rgba(15,23,42,0.5)] sm:rounded-[28px] sm:p-5">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<p class="text-sm font-semibold text-sky-300">Struk resep</p>
							<h3 class="mt-1 text-lg font-semibold">Preview</h3>
						</div>
						<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
							<button type="button" class="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20" onclick={() => (receiptVisible = !receiptVisible)}>
								{receiptVisible ? 'Sembunyikan' : 'Tampilkan'}
							</button>
							<button type="button" class="rounded-2xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400" onclick={printReceipt}>
								Cetak struk
							</button>
						</div>
					</div>

					{#if receiptVisible}
						<div class="receipt-print-shell mt-4 rounded-[24px] border border-white/10 bg-white p-4 text-slate-900 shadow-inner">
							<div class="receipt-print-card mx-auto w-full max-w-[280px] rounded-[16px] border border-slate-200 bg-[#fffdf8] p-3">
								<div class="text-center">
									<p class="text-[11px] font-black uppercase tracking-[0.35em] text-slate-900">RS Medika Sehat</p>
									<p class="mt-1 text-[9px] uppercase tracking-[0.3em] text-slate-500">Struk Resep Dokter</p>
								</div>
								<hr class="receipt-print-divider mt-2" />
								<div class="mt-2 text-[10px] text-slate-600">
									<div class="flex items-center justify-between gap-2">
										<span>No. Transaksi</span>
										<span class="font-semibold text-slate-900">RX-2026-007</span>
									</div>
									<div class="mt-1 flex items-center justify-between gap-2">
										<span>Waktu</span>
										<span class="font-semibold text-slate-900">{new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
									</div>
								</div>
								<hr class="receipt-print-divider mt-2" />
								<div class="mt-2 text-[10px] text-slate-600">
									<p><span class="font-semibold text-slate-900">Pasien:</span> {selectedPatient}</p>
									<p class="mt-1"><span class="font-semibold text-slate-900">Diagnosa:</span> {diagnosis}</p>
									<div class="mt-2">
										<p class="font-semibold uppercase tracking-[0.2em] text-slate-900">Daftar obat</p>
										<ul class="mt-1 space-y-1">
											{#each selectedMedicines as item (item.name)}
												<li class="receipt-print-line-item">
													<p class="font-semibold text-slate-900">{item.name}</p>
													<p class="mt-1 text-[9px] text-slate-500">{item.usage ? `Pemakaian: ${item.usage}` : 'Pemakaian: belum diisi'}</p>
												</li>
											{/each}
											{#if selectedMedicines.length === 0}
												<li class="text-slate-500">Belum ada obat</li>
											{/if}
										</ul>
									</div>
									<div class="receipt-print-stamp mt-2 rounded-[8px] p-2 text-[9px] text-emerald-700">
										Reservasi obat berhasil dibuat. Silakan serahkan struk ke apotek.
									</div>
								</div>
								<div class="receipt-print-footer text-center text-[9px] uppercase tracking-[0.22em] text-slate-400">
									<p>Dokter pemeriksa</p>
									<div class="mx-auto mt-4 h-7 w-20 border-b border-slate-300"></div>
									<p class="mt-2 text-[9px] text-slate-600">dr. Anindita</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</aside>
		</div>
	</div>
</div>
