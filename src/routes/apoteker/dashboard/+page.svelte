<script lang="ts">
	import { browser } from '$app/environment';

	type PrescriptionStatus = 'Menunggu' | 'Siap ambil' | 'Selesai';
	type DashboardUser = {
		role: string;
		name: string;
		id: string;
	};

	function readCookie(name: string) {
		if (!browser || typeof document === 'undefined') return '';
		const cookie = document.cookie
			.split(';')
			.map((item) => item.trim())
			.find((item) => item.startsWith(`${name}=`));
		if (!cookie) return '';
		return decodeURIComponent(cookie.substring(name.length + 1));
	}

	function getSessionFromCookie() {
		const role = readCookie('medsync_role') || readCookie('role') || 'apoteker';
		const name = readCookie('medsync_name') || readCookie('user_name') || readCookie('name') || readCookie('full_name') || 'Apoteker';
		const id = readCookie('medsync_user_id') || readCookie('user_id') || readCookie('id_apoteker') || '';
		return { role, name, id };
	}

	let currentUser = $state<DashboardUser>({ role: 'apoteker', name: '', id: '' });
	if (browser) {
		currentUser = getSessionFromCookie();
	}

	let prescriptions = $state([
		{
			id: 1,
			patient: 'Ayu Putri',
			doctor: 'dr. Nanda',
			time: '08:15 WIB',
			status: 'Menunggu' as PrescriptionStatus,
			medicines: ['Paracetamol 500mg', 'Amoxicillin 500mg']
		},
		{
			id: 2,
			patient: 'Rizky Pratama',
			doctor: 'dr. Lina',
			time: '09:05 WIB',
			status: 'Siap ambil' as PrescriptionStatus,
			medicines: ['Omeprazole 20mg']
		},
		{
			id: 3,
			patient: 'Dewi Sartika',
			doctor: 'dr. Arif',
			time: '09:40 WIB',
			status: 'Selesai' as PrescriptionStatus,
			medicines: ['Metformin 500mg', 'Paracetamol 500mg']
		}
	]);

	let inventory = $state([
		{ name: 'Paracetamol 500mg', category: 'Analgesik', quantity: 42, note: 'Stok aman' },
		{ name: 'Amoxicillin 500mg', category: 'Antibiotik', quantity: 8, note: 'Perlu restock' },
		{ name: 'Omeprazole 20mg', category: 'Pencernaan', quantity: 6, note: 'Stok menipis' },
		{ name: 'Metformin 500mg', category: 'Diabetes', quantity: 31, note: 'Stok aman' }
	]);

	let pickupQueue = $state([
		{ patient: 'Sari Wulandari', medicine: 'Amoxicillin 500mg', time: '10:00 WIB' },
		{ patient: 'Bima Kurniawan', medicine: 'Omeprazole 20mg', time: '10:20 WIB' }
	]);
	let searchQuery = $state('');
	let verifyNote = $state('');
	let verifiedIds = $state<number[]>([]);

	let filteredPrescriptions = $derived(
		prescriptions.filter((item) => {
			const query = searchQuery.toLowerCase();
			return (
				item.patient.toLowerCase().includes(query) ||
				item.doctor.toLowerCase().includes(query) ||
				item.medicines.some((medicine) => medicine.toLowerCase().includes(query))
			);
		})
	);

	function buildPrescriptionPayload(prescription: { patient: string; doctor: string; medicines: string[]; time: string; status: PrescriptionStatus }) {
		const apotekerId = currentUser.id || readCookie('id_apoteker') || readCookie('medsync_apoteker_id') || '';
		return {
			pasien: prescription.patient,
			dokter: prescription.doctor,
			detail_obat: prescription.medicines,
			waktu_pengambilan: prescription.time,
			status: prescription.status,
			id_apoteker: apotekerId,
			catatan_verifikasi: verifyNote || ''
		};
	}

	function submitPrescriptionRecord(prescription: { patient: string; doctor: string; medicines: string[]; time: string; status: PrescriptionStatus }) {
		const payload = buildPrescriptionPayload(prescription);
		console.log('Payload resep_dokter siap dikirim:', payload);
		return payload;
	}

	function updateStatus(id: number, status: PrescriptionStatus) {
		prescriptions = prescriptions.map((item) => (item.id === id ? { ...item, status } : item));
		const selected = prescriptions.find((item) => item.id === id);
		if (selected) {
			submitPrescriptionRecord(selected);
		}
	}

	function toggleVerification(id: number) {
		verifiedIds = verifiedIds.includes(id)
			? verifiedIds.filter((itemId) => itemId !== id)
			: [...verifiedIds, id];
	}
</script>

<svelte:head>
	<title>Dashboard Apoteker | MedSync</title>
</svelte:head>

<div class="min-h-screen bg-[linear-gradient(90deg,_#fffaf2_0%,_#f7f9ff_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
		<header class="rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-800 to-orange-600 p-4 text-white shadow-[0_20px_60px_-35px_rgba(245,158,11,0.45)] backdrop-blur sm:rounded-[28px] sm:p-6">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="min-w-0">
					<p class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-100 sm:text-sm">Dashboard Apoteker</p>
					<h1 class="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-3xl">
						Verifikasi resep, cek stok, dan bantu pengambilan obat
					</h1>
				</div>
				<div class="rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-amber-50 sm:px-4 sm:py-3">
					<span class="font-semibold">Shift siang</span> • 10:00 WIB • Apotek Medika Sehat
				</div>
			</div>
			<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
				<div class="text-sm font-semibold text-amber-50">
					Selamat datang, {currentUser.name || 'Apoteker'}
				</div>
				<div class="flex flex-wrap items-center gap-2 text-sm text-amber-100">
					<span class="rounded-full border border-white/20 bg-white/10 px-3 py-1">Login sebagai {currentUser.name || 'Apoteker'}</span>
					<span class="rounded-full border border-white/20 bg-white/10 px-3 py-1">{currentUser.id ? `ID: ${currentUser.id}` : 'ID belum tersedia'}</span>
				</div>
			</div>
		</header>

		<section class="grid gap-3 sm:grid-cols-3 sm:gap-4">
			<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Resep menunggu</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">{prescriptions.filter((item) => item.status === 'Menunggu').length}</p>
			</div>
			<div class="rounded-2xl border border-amber-200 bg-orange-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Siap diambil</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">{prescriptions.filter((item) => item.status === 'Siap ambil').length}</p>
			</div>
			<div class="rounded-2xl border border-amber-200 bg-amber-100 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Pengambilan hari ini</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">{pickupQueue.length}</p>
			</div>
		</section>

		<div class="grid gap-5 xl:grid-cols-[1.25fr_0.8fr]">
			<section class="rounded-[24px] border border-amber-200 bg-white p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6 lg:p-7">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div class="min-w-0">
						<p class="text-sm font-semibold text-amber-700">Antrian resep</p>
						<h2 class="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Verifikasi dan proses obat</h2>
					</div>
					<button class="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 sm:w-auto">
						Lihat semua resep
					</button>
				</div>

				<div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
					<label class="block text-sm font-medium text-slate-700">
						<span class="mb-2 block">Cari resep atau nama pasien</span>
						<input bind:value={searchQuery} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Cari pasien, dokter, atau obat" />
					</label>
				</div>

				<div class="mt-6 space-y-3">
					{#each filteredPrescriptions as prescription (prescription.id)}
						<article class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
							<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="text-base font-semibold text-slate-900">{prescription.patient}</h3>
										<span class={`rounded-full px-3 py-1 text-xs font-semibold ${prescription.status === 'Menunggu' ? 'bg-amber-100 text-amber-700' : prescription.status === 'Siap ambil' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
											{prescription.status}
										</span>
									</div>
									<p class="mt-1 text-sm text-slate-500">Dokter: {prescription.doctor}</p>
									<p class="mt-1 text-sm text-slate-500">Waktu masuk: {prescription.time}</p>
								</div>
								<div class="flex flex-wrap gap-2 sm:justify-end">
									<button type="button" class="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700" onclick={() => updateStatus(prescription.id, 'Siap ambil')}>
										Siapkan obat
									</button>
									<button type="button" class="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500" onclick={() => updateStatus(prescription.id, 'Selesai')}>
										Selesai
									</button>
								</div>
							</div>
							<div class="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
								<p class="text-sm font-semibold text-slate-900">Daftar obat</p>
								<div class="mt-2 flex flex-wrap gap-2">
									{#each prescription.medicines as medicine, index (index)}
										<span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{medicine}</span>
									{/each}
								</div>
								<div class="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
									<label class="flex items-center gap-2 text-sm text-slate-700">
										<input type="checkbox" checked={verifiedIds.includes(prescription.id)} onchange={() => toggleVerification(prescription.id)} class="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
										<span>Obat sudah sesuai dengan resep</span>
									</label>
									<input bind:value={verifyNote} class="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100" placeholder="Catatan verifikasi" />
								</div>
							</div>
						</article>
					{/each}
				</div>
			</section>

			<aside class="space-y-4">
				<div class="rounded-[24px] border border-amber-200 bg-amber-50 p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-5">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div class="min-w-0">
							<p class="text-sm font-semibold text-amber-700">Stok obat</p>
							<h3 class="mt-1 text-lg font-semibold text-slate-900">Kondisi persediaan</h3>
						</div>
						<button class="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
							Restock
						</button>
					</div>

					<div class="mt-4 space-y-2">
						{#each inventory as item (item.name)}
							<div class={`rounded-2xl border p-3 ${item.quantity < 10 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="font-semibold text-slate-900">{item.name}</p>
										<p class="mt-1 text-xs text-slate-500">{item.category}</p>
									</div>
									<span class={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.quantity < 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
										{item.quantity} box
									</span>
								</div>
								<p class={`mt-2 text-xs ${item.quantity < 10 ? 'text-amber-700' : 'text-slate-500'}`}>{item.note}</p>
							</div>
						{/each}
					</div>
				</div>

				<div class="rounded-[24px] border border-amber-200 bg-slate-950 p-4 text-white shadow-[0_16px_44px_-32px_rgba(15,23,42,0.5)] sm:rounded-[28px] sm:p-5">
					<p class="text-sm font-semibold text-amber-300">Pengambilan obat</p>
					<h3 class="mt-1 text-lg font-semibold">Jadwal hari ini</h3>
					<div class="mt-4 space-y-2">
						{#each pickupQueue as item (item.patient)}
							<div class="rounded-2xl border border-white/10 bg-white/10 p-3 text-sm">
								<p class="font-semibold">{item.patient}</p>
								<p class="mt-1 text-slate-300">{item.medicine}</p>
								<p class="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{item.time}</p>
							</div>
						{/each}
					</div>
				</div>
			</aside>
		</div>
	</div>
</div>
