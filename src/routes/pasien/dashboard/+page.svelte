<script lang="ts">
	import { browser } from '$app/environment';

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
		const role = readCookie('medsync_role') || readCookie('role') || 'pasien';
		const name = readCookie('medsync_name') || readCookie('user_name') || readCookie('name') || readCookie('full_name') || 'Ayu Putri';
		const id = readCookie('medsync_user_id') || readCookie('user_id') || readCookie('id_pasien') || 'BP-2054';
		return { role, name, id };
	}

	let currentUser = $state<DashboardUser>({ role: 'pasien', name: '', id: '' });
	if (browser) {
		currentUser = getSessionFromCookie();
	}

	let appointments = $state([
		{
			id: 1,
			label: 'Konsultasi dokter',
			doctor: 'dr. Nanda Putri',
			date: 'Senin, 29 Juli 2026',
			time: '09:30 WIB',
			location: 'Poliklinik Anak'
		},
		{
			id: 2,
			label: 'Kontrol obat',
			doctor: 'dr. Arif Wijaya',
			date: 'Rabu, 31 Juli 2026',
			time: '14:00 WIB',
			location: 'Instalasi Rawat Jalan'
		}
	]);

	let prescriptions = $state([
		{
			id: 1,
			medicine: 'Paracetamol 500mg',
			status: 'Siap diambil',
			dose: '3x1 sehari',
			doctor: 'dr. Nanda Putri',
			pickup: 'Apotek siap verifikasi'
		},
		{
			id: 2,
			medicine: 'Amoxicillin 500mg',
			status: 'Dalam proses',
			dose: '2x1 sehari',
			doctor: 'dr. Arif Wijaya',
			pickup: 'Menunggu persetujuan apoteker'
		}
	]);

	let careUpdates = $state([
		{
			id: 1,
			title: 'Hasil pemeriksaan terbaru',
			body: 'Tekanan darah stabil dan kondisi umum membaik. Disarankan tetap minum obat sesuai jadwal.',
			meta: 'Diperbarui 2 jam lalu'
		},
		{
			id: 2,
			title: 'Catatan dokter',
			body: 'Jaga hidrasi dan hindari makanan berat selama 3 hari ke depan.',
			meta: 'Ditambahkan oleh dokter'
		}
	]);

	let quickActions = [
		{ label: 'Lihat resep', href: '#resep' },
		{ label: 'Cek janji temu', href: '#janji' },
		{ label: 'Hubungi tim medis', href: '#tim' }
	];
</script>

<svelte:head>
	<title>Dashboard Pasien | MedSync</title>
</svelte:head>

<div class="min-h-screen bg-[linear-gradient(90deg,_#f7fbff_0%,_#f3f9ff_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<div class="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
		<header class="rounded-[24px] border border-sky-200 bg-gradient-to-r from-sky-900 to-cyan-700 p-4 text-white shadow-[0_20px_60px_-35px_rgba(2,132,199,0.5)] sm:rounded-[28px] sm:p-6">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="min-w-0">
					<p class="text-xs font-semibold uppercase tracking-[0.3em] text-sky-100 sm:text-sm">Dashboard Pasien</p>
					<h1 class="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-3xl">
						Pantau janji temu, resep, dan perkembangan kesehatan Anda
					</h1>
				</div>
				<div class="rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-sky-50 sm:px-4 sm:py-3">
					<span class="font-semibold">Hari ini</span> • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
				</div>
			</div>

			<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
				<div class="text-sm font-semibold text-sky-50">
					Halo, {currentUser.name || 'Pasien'}
				</div>
				<div class="flex flex-wrap items-center gap-2 text-sm text-sky-100">
					<span class="rounded-full border border-white/20 bg-white/10 px-3 py-1">Nomor pasien {currentUser.id || 'BP-2054'}</span>
					<span class="rounded-full border border-white/20 bg-white/10 px-3 py-1">Portal MedSync</span>
				</div>
			</div>
		</header>

		<section class="grid gap-3 sm:grid-cols-3 sm:gap-4">
			<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Janji temu berikutnya</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">2</p>
			</div>
			<div class="rounded-2xl border border-sky-200 bg-cyan-50 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Resep aktif</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">{prescriptions.length}</p>
			</div>
			<div class="rounded-2xl border border-sky-200 bg-sky-100 p-4 shadow-sm">
				<p class="text-sm text-slate-600">Status obat</p>
				<p class="mt-2 text-2xl font-semibold text-slate-900">1 siap ambil</p>
			</div>
		</section>

		<div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
			<section class="space-y-4">
				<div id="janji" class="rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6 lg:p-7">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p class="text-sm font-semibold text-sky-700">Jadwal Anda</p>
							<h2 class="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Janji temu dan kunjungan</h2>
						</div>
						<button class="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 sm:w-auto">
							Lihat semua
						</button>
					</div>

					<div class="mt-4 space-y-3">
						{#each appointments as item (item.id)}
							<article class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
								<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p class="text-sm font-semibold text-slate-900">{item.label}</p>
										<p class="mt-1 text-sm text-slate-500">Dokter: {item.doctor}</p>
										<p class="mt-1 text-sm text-slate-500">{item.date} • {item.time}</p>
										<p class="mt-1 text-sm text-slate-500">Lokasi: {item.location}</p>
									</div>
									<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Terjadwal</span>
								</div>
							</article>
						{/each}
					</div>
				</div>

				<div id="resep" class="rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-6 lg:p-7">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p class="text-sm font-semibold text-sky-700">Resep Anda</p>
							<h2 class="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Informasi obat dan status pengambilan</h2>
						</div>
					</div>

					<div class="mt-4 space-y-3">
						{#each prescriptions as prescription (prescription.id)}
							<article class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<h3 class="text-base font-semibold text-slate-900">{prescription.medicine}</h3>
									<span class={`rounded-full px-3 py-1 text-xs font-semibold ${prescription.status === 'Siap diambil' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
										{prescription.status}
									</span>
								</div>
								<p class="mt-2 text-sm text-slate-500">Dosis: {prescription.dose}</p>
								<p class="mt-1 text-sm text-slate-500">Dokter: {prescription.doctor}</p>
								<p class="mt-1 text-sm text-slate-500">{prescription.pickup}</p>
							</article>
						{/each}
					</div>
				</div>
			</section>

			<aside class="space-y-4">
				<div class="rounded-[24px] border border-sky-200 bg-sky-50 p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-5">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-sky-700">Aksi cepat</p>
							<h3 class="mt-1 text-lg font-semibold text-slate-900">Menu utama</h3>
						</div>
					</div>
					<div class="mt-4 space-y-2">
						{#each quickActions as action}
							<a href={action.href} class="flex items-center justify-between rounded-2xl border border-sky-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
								<span>{action.label}</span>
								<span>→</span>
							</a>
						{/each}
					</div>
				</div>

				<div id="tim" class="rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-5">
					<p class="text-sm font-semibold text-sky-700">Tim perawatan</p>
					<div class="mt-4 space-y-3">
						<div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
							<p class="font-semibold text-slate-900">dr. Nanda Putri</p>
							<p class="mt-1 text-sm text-slate-500">Dokter penanggung jawab</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
							<p class="font-semibold text-slate-900">Apoteker Sari</p>
							<p class="mt-1 text-sm text-slate-500">Verifikasi obat dan pengambilan</p>
						</div>
					</div>
				</div>

				<div class="rounded-[24px] border border-sky-200 bg-slate-900 p-4 text-white shadow-[0_16px_44px_-32px_rgba(15,23,42,0.35)] sm:rounded-[28px] sm:p-5">
					<p class="text-sm font-semibold text-sky-300">Perkembangan kesehatan</p>
					<div class="mt-4 space-y-3">
						{#each careUpdates as update (update.id)}
							<div class="rounded-2xl border border-white/10 bg-white/10 p-3">
								<p class="font-semibold text-white">{update.title}</p>
								<p class="mt-2 text-sm leading-6 text-slate-300">{update.body}</p>
								<p class="mt-2 text-xs text-sky-200">{update.meta}</p>
							</div>
						{/each}
					</div>
				</div>
			</aside>
		</div>
	</div>
</div>
