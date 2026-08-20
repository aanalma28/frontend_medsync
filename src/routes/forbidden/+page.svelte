<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>403 - Akses Ditolak | MedSync</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
	<div class="max-w-md space-y-6">
		<!-- Ikon & Angka 403 (Diperbesar agar lebih mencolok) -->
		<div class="flex flex-col items-center justify-center space-y-4">
			<div class="rounded-full bg-red-100 p-4 text-red-600 shadow-sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-12 w-12"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728"
					/>
				</svg>
			</div>
			<h1 class="text-6xl font-black tracking-widest text-slate-300 select-none">403</h1>
		</div>

		<!-- Judul & Keterangan (Judul diperbesar) -->
		<div class="space-y-3">
			<h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Akses Ditolak</h2>
			<p class="text-sm leading-relaxed text-slate-600 sm:text-base">
				Maaf, Anda tidak memiliki izin atau peran (<span class="font-semibold text-slate-700"
					>role</span
				>) yang valid untuk mengakses halaman ini. Sesi Anda tidak terautentikasi atau telah
				berakhir.
			</p>
		</div>

		<!-- Tombol Navigasi (Hanya 1 tombol) -->
		<div class="pt-2">
			<button
				onclick={() => goto('/login')}
				class="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
			>
				Kembali ke Halaman Login
			</button>
		</div>
	</div>
</div>
