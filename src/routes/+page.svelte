<script lang="ts">
	const highlights = [
		{
			title: 'Layanan cepat',
			description: 'Alur pendaftaran dan pemantauan resep dibuat ringkas untuk menghemat waktu pasien.',
			icon: '🩺',
			accent: 'bg-sky-100 text-sky-700'
		},
		{
			title: 'Kolaborasi tim',
			description: 'Dokter, apoteker, dan staf dapat bekerja dalam satu ekosistem yang terhubung.',
			icon: '💊',
			accent: 'bg-emerald-100 text-emerald-700'
		},
		{
			title: 'Informasi aman',
			description: 'Setiap langkah dirancang dengan fokus pada keamanan data dan kenyamanan pengguna.',
			icon: '🔒',
			accent: 'bg-violet-100 text-violet-700'
		}
	];

	const testimonials = [
		{
			name: 'Alya Putri',
			role: 'Pasien',
			quote: 'Saya merasa proses berobat jadi jauh lebih cepat dan terarah. Informasi resep dan jadwalnya sangat jelas.',
			rating: 5,
			image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'
		},
		{
			name: 'Dr. Bima Prasetyo',
			role: 'Dokter',
			quote: 'Platform ini membantu saya memantau kebutuhan pasien dengan lebih baik dan mengurangi kebingungan administrasi.',
			rating: 5,
			image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80'
		},
		{
			name: 'Siti Nurhaliza',
			role: 'Apoteker',
			quote: 'Saya suka alurnya yang rapi, terutama saat menyiapkan obat dan memverifikasi resep dengan lebih aman.',
			rating: 4,
			image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80'
		},
		{
			name: 'Rina Azzahra',
			role: 'Pasien',
			quote: 'Saya sangat terbantu karena semua informasi ada di satu tempat. Tidak perlu bingung lagi mencari rincian layanan.',
			rating: 5,
			image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80'
		},
		{
			name: 'Arif Kurniawan',
			role: 'Staff Klinik',
			quote: 'Alur kerja jadi lebih tertata dan cepat, terutama saat kami menyiapkan data pasien dan obat untuk pengambilan.',
			rating: 5,
			image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80'
		}
	];

	const socialLinks = [
		{ label: 'Instagram', href: 'https://instagram.com/medsync' },
		{ label: 'Facebook', href: 'https://facebook.com/medsync' },
		{ label: 'LinkedIn', href: 'https://linkedin.com/company/medsync' }
	];

	let testimonialTrack: HTMLElement | null = $state(null);

	function scrollTestimonials(direction: number) {
		testimonialTrack?.scrollBy({ left: direction * 360, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>MedSync | Platform Kesehatan Modern</title>
	<meta
		name="description"
		content="MedSync membantu pasien, dokter, dan apoteker terhubung lebih cepat melalui layanan kesehatan modern, aman, dan profesional."
	/>
	<meta
		name="keywords"
		content="medsync, layanan kesehatan, dokter, apotek, resep digital, konsultasi medis"
	/>
	<meta property="og:title" content="MedSync | Platform Kesehatan Modern" />
	<meta
		property="og:description"
		content="Berobat Cepat hanya di MedSync, dengan pengalaman layanan kesehatan yang lebih terintegrasi dan nyaman."
	/>
	<meta property="og:type" content="website" />
	<meta
		property="og:image"
		content="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80"
	/>
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#eef6ff_100%)] text-slate-900">
	<header class="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
		<a href="/" class="flex items-center gap-3 text-lg font-semibold tracking-wide text-slate-800">
			<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-xl font-bold text-white shadow-lg shadow-sky-200">
				M
			</div>
			<span>MedSync</span>
		</a>
		<nav class="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
			<a class="transition hover:text-sky-700" href="#fitur">Fitur</a>
			<a class="transition hover:text-sky-700" href="#tentang">Tentang</a>
			<a class="transition hover:text-sky-700" href="/login">Masuk</a>
		</nav>
	</header>

	<main class="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
		<section class="grid items-center gap-10 rounded-[32px] border border-slate-200/80 bg-white/80 px-6 py-10 shadow-[0_25px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur md:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-14 lg:py-16">
			<div>
				<div class="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
					Solusi kesehatan modern untuk semua peran
				</div>
				<h1 class="mt-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
					Berobat Cepat hanya di MedSync
				</h1>
				<p class="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
					MedSync hadir untuk mempercepat proses layanan kesehatan, memudahkan pasien, dokter, dan apoteker bekerja lebih terintegrasi, serta menjaga pengalaman berobat tetap nyaman dan profesional.
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<a href="/register" class="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700">
						Daftar Sekarang
					</a>
					<a href="/login" class="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
						Masuk ke akun
					</a>
				</div>
				<div class="mt-8 grid gap-3 sm:grid-cols-3">
					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
						<p class="text-2xl font-semibold text-slate-900">24/7</p>
						<p class="mt-1 text-sm text-slate-600">Akses informasi layanan dengan lebih mudah.</p>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
						<p class="text-2xl font-semibold text-slate-900">+300</p>
						<p class="mt-1 text-sm text-slate-600">Pasien dan tenaga kesehatan terbantu.</p>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
						<p class="text-2xl font-semibold text-slate-900">100%</p>
						<p class="mt-1 text-sm text-slate-600">Fokus pada pengalaman layanan yang jelas.</p>
					</div>
				</div>
			</div>

		<div class="relative">
			<div class="absolute inset-0 rounded-[28px] bg-sky-100/60 blur-3xl" aria-hidden="true"></div>
			<div class="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900 shadow-2xl">
				<img
					src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80"
					alt="Dokter memeriksa pasien dalam suasana klinik yang bersih dan modern"
					class="h-[420px] w-full object-cover"
				/>
				<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent p-6 text-white">
					<p class="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">Klinik modern</p>
					<p class="mt-2 text-lg font-medium">Dukungan pelayanan yang lebih cepat, lebih aman, dan lebih terarah.</p>
				</div>
			</div>
		</div>
		</section>

		<section id="fitur" class="mt-12 grid gap-6 lg:grid-cols-3">
			{#each highlights as item (item.title)}
				<article class="rounded-[24px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
					<div class={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${item.accent}`}>
						{item.icon}
					</div>
					<h2 class="text-xl font-semibold text-slate-900">{item.title}</h2>
					<p class="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
				</article>
			{/each}
		</section>

		<section id="testimoni" class="mt-12">
			<div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<p class="text-sm font-semibold uppercase tracking-[0.35em] text-sky-700">Testimoni</p>
					<h2 class="mt-2 text-3xl font-semibold text-slate-900">Apa kata pengguna MedSync?</h2>
				</div>
			</div>
			<div class="relative mt-6">
				<button type="button" class="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-lg text-slate-700 shadow-lg shadow-slate-200/60 backdrop-blur transition hover:border-sky-300 hover:text-sky-700" onclick={() => scrollTestimonials(-1)} aria-label="Testimoni sebelumnya">
					←
				</button>
				<button type="button" class="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-lg text-slate-700 shadow-lg shadow-slate-200/60 backdrop-blur transition hover:border-sky-300 hover:text-sky-700" onclick={() => scrollTestimonials(1)} aria-label="Testimoni berikutnya">
					→
				</button>
				<div bind:this={testimonialTrack} class="overflow-x-auto pb-2 pl-12 pr-12 scrollbar-none">
					<div class="flex min-w-max gap-6">
						{#each testimonials as person}
							<article class="w-[320px] rounded-[24px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur sm:w-[340px]">
								<div class="flex items-center gap-3">
									<img src={person.image} alt={person.name} class="h-12 w-12 rounded-full object-cover" />
									<div>
										<h3 class="font-semibold text-slate-900">{person.name}</h3>
										<p class="text-sm text-slate-500">{person.role}</p>
									</div>
								</div>
								<div class="mt-4 text-lg text-amber-500">{'★'.repeat(person.rating)}{'☆'.repeat(5 - person.rating)}</div>
								<p class="mt-3 text-sm leading-7 text-slate-600">“{person.quote}”</p>
							</article>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section id="tentang" class="mt-12 rounded-[28px] border border-slate-200 bg-slate-900 px-6 py-8 text-white shadow-[0_20px_70px_-34px_rgba(15,23,42,0.9)] md:px-10 lg:px-12">
			<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<div class="max-w-2xl">
					<p class="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">Tentang MedSync</p>
					<h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
						Menghubungkan kebutuhan pasien, dokter, dan apoteker dalam satu perjalanan kesehatan.
					</h2>
				</div>
				<p class="max-w-xl text-sm leading-8 text-slate-300">
					MedSync membawa pendekatan yang lebih terorganisir untuk pengelolaan layanan kesehatan, mulai dari pendaftaran, pemantauan resep, hingga pendampingan administratif yang lebih jelas.
				</p>
			</div>
		</section>
	</main>

	<footer class="border-t border-slate-200/80 bg-white/70 px-6 py-8 backdrop-blur">
		<div class="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-lg font-semibold text-slate-900">MedSync</p>
				<p class="mt-1 text-sm text-slate-600">Berobat Cepat hanya di MedSync.</p>
			</div>
			<div class="flex flex-wrap gap-3">
				{#each socialLinks as item}
					<a href={item.href} class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
						{item.label}
					</a>
				{/each}
			</div>
		</div>
	</footer>
</div>
