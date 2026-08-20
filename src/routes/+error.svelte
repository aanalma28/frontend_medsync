<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>{$page.status} - Terjadi Kesalahan | MedSync</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 text-center"
>
	<div class="max-w-md space-y-6">
		{#if $page.status === 403}
			<!-- TAMPILAN KHUSUS KETIKA 403 FORBIDDEN -->
			<div class="flex flex-col items-center justify-center space-y-2">
				<div class="rounded-full bg-red-100 p-4 text-red-600 shadow-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-10 w-10"
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
				<h1
					class="text-[15rem] leading-none font-black tracking-wider text-slate-200/80 select-none sm:text-[20rem]"
				>
					403
				</h1>
			</div>

			<div class="relative z-10 -mt-16 space-y-3 sm:-mt-24">
				<h2 class="text-3xl font-extrabold tracking-tight text-slate-900">Akses Ditolak</h2>
				<p class="text-sm leading-relaxed text-slate-600 sm:text-base">
					Maaf, Anda tidak memiliki izin atau peran (<span class="font-semibold text-slate-700"
						>role</span
					>) yang valid untuk mengakses halaman ini. Sesi Anda tidak terautentikasi atau telah
					berakhir.
				</p>
			</div>
		{:else}
			<!-- TAMPILAN UNTUK ERROR LAIN (Misal: 404 Not Found, 500, dll) -->
			<div class="space-y-2">
				<h1 class="text-7xl font-black text-slate-300">{$page.status}</h1>
				<h2 class="text-2xl font-bold text-slate-800">Terjadi Kesalahan</h2>
				<p class="text-sm text-slate-600">
					{$page.error?.message ||
						'Maaf, halaman yang Anda cari tidak dapat ditemukan atau terjadi gangguan pada server.'}
				</p>
			</div>
		{/if}

		<!-- Tombol Navigasi Umum -->
		<div class="relative z-10 pt-4">
			<button
				onclick={() => goto('/login')}
				class="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-bold text-white shadow-xl shadow-slate-300 transition-all hover:bg-slate-800 hover:shadow-2xl focus:ring-4 focus:ring-slate-300 focus:outline-none active:scale-[0.98]"
			>
				Kembali ke Halaman Login
			</button>
		</div>
	</div>
</div>
