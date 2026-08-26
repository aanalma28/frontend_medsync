<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		status?: number;
		title?: string;
		message?: string;
		onAction?: () => void;
		actionLabel?: string;
	}

	let {
		status = 500,
		title = '',
		message = '',
		onAction = () => goto('/login'),
		actionLabel = 'Kembali ke Halaman Login'
	}: Props = $props();

	// Logika penentuan teks otomatis berdasarkan status error
	let computedTitle = $derived(() => {
		if (title) return title;
		if (status === 403) return 'Akses Ditolak';
		if (status === 404) return 'Halaman Tidak Ditemukan';
		if (status === 500) return 'Kesalahan pada Server';
		return 'Terjadi Kesalahan';
	});

	let computedMessage = $derived(() => {
		if (message) return message;
		if (status === 403)
			return 'Maaf, Anda tidak memiliki izin atau peran (role) yang valid untuk mengakses halaman ini. Sesi Anda tidak terautentikasi atau telah berakhir.';
		if (status === 404)
			return 'Maaf, halaman atau rute yang Anda cari tidak dapat ditemukan di sistem MedSync.';
		if (status === 500)
			return 'Terjadi gangguan teknis pada server kami. Silakan coba beberapa saat lagi.';
		return 'Maaf, terjadi kesalahan yang tidak terduga pada sistem.';
	});
</script>

<svelte:head>
	<title>{status} - {computedTitle()} | MedSync</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 text-center"
>
	<div class="max-w-md space-y-6">
		{#if status === 403}
			<!-- TAMPILAN KHUSUS 403 FORBIDDEN -->
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
					class="text-[6rem] leading-none font-black tracking-wider text-slate-200/80 select-none sm:text-[6rem]"
				>
					403
				</h1>
				<div class="relative z-10 space-y-3">
					<h2 class="text-3xl font-extrabold tracking-tight text-slate-900">
						{computedTitle()}
					</h2>
					<p class="text-sm leading-relaxed text-slate-600 sm:text-base">{computedMessage()}</p>
				</div>
			</div>
		{:else if status === 404}
			<!-- TAMPILAN KHUSUS 404 NOT FOUND -->
			<div class="flex flex-col items-center justify-center space-y-2">
				<div class="rounded-full bg-amber-100 p-4 text-amber-600 shadow-sm">
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
							d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h1
					class="text-[12rem] leading-none font-black tracking-wider text-slate-200/80 select-none sm:text-[16rem]"
				>
					404
				</h1>
			</div>
			<div class="relative z-10 -mt-12 space-y-3 sm:-mt-20">
				<h2 class="text-3xl font-extrabold tracking-tight text-slate-900">{computedTitle()}</h2>
				<p class="text-sm leading-relaxed text-slate-600 sm:text-base">{computedMessage()}</p>
			</div>
		{:else}
			<!-- TAMPILAN UNTUK 500 ATAU ERROR UMUM LAINNYA -->
			<div class="space-y-2">
				<h1 class="text-7xl font-black text-slate-300">{status}</h1>
				<h2 class="text-2xl font-bold text-slate-800">{computedTitle()}</h2>
				<p class="text-sm text-slate-600">{computedMessage()}</p>
			</div>
		{/if}

		<!-- Tombol Aksi -->
		<div class="relative z-10 pt-4">
			<button
				onclick={onAction}
				class="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-bold text-white shadow-xl shadow-slate-300 transition-all hover:bg-slate-800 hover:shadow-2xl focus:ring-4 focus:ring-slate-300 focus:outline-none active:scale-[0.98]"
			>
				{actionLabel}
			</button>
		</div>
	</div>
</div>
