<script lang="ts">
	import { api } from '$lib/api/api';
	import { clearAuth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	interface Props {
		role?: 'pasien' | 'dokter' | 'admin' | 'superadmin';
		activeMenu: string;
		isOpen: boolean;
		onMenuSelect: (menuId: string) => void;
		onClose: () => void;
	}

	let { role = 'pasien', activeMenu, isOpen, onMenuSelect, onClose }: Props = $props();

	// 1. Sekarang config HANYA menyimpan nama ikon berupa string biasa
	const menuConfig = {
		pasien: [
			{ id: 'beranda', label: 'Beranda', iconName: 'beranda' },
			{ id: 'janji', label: 'Janji Temu', iconName: 'janji' },
			{ id: 'resep', label: 'Resep Obat', iconName: 'resep' },
			{ id: 'pengaturan', label: 'Pengaturan', iconName: 'pengaturan' }
		],
		dokter: [
			{ id: 'beranda', label: 'Dasbor Dokter', iconName: 'beranda' },
			{ id: 'jadwal', label: 'Jadwal Praktik', iconName: 'janji' },
			{ id: 'pasien', label: 'Daftar Pasien', iconName: 'users' }
		],
		admin: [
			{ id: 'beranda', label: 'Panel Admin', iconName: 'beranda' },
			{ id: 'registrasi-staf', label: 'Registrasi Staf', iconName: 'user-plus' },
			{ id: 'departemen', label: 'Departemen Staf', iconName: 'building' },
			{ id: 'reset-password', label: 'Reset Password', iconName: 'key' },
			{ id: 'data-master', label: 'Data Master Poli', iconName: 'database' }
		],
		superadmin: [
			{ id: 'beranda', label: 'Superadmin Dasbor', iconName: 'beranda' },
			{ id: 'admin-mgmt', label: 'Manajemen Admin', iconName: 'shield' },
			{ id: 'reports', label: 'Laporan Finansial', iconName: 'chart' },
			{ id: 'settings', label: 'Pengaturan Global', iconName: 'pengaturan' },
			{ id: 'branches', label: 'Oversight Cabang', iconName: 'globe' }
		],
		apoteker: [
			{ id: 'beranda', label: 'Dasbor Apoteker', iconName: 'beranda' },
			{ id: 'users', label: 'Data User', iconName: 'users' },
			{ id: 'pengaturan', label: 'Pengaturan', iconName: 'pengaturan' }
		]
	};

	let currentMenus = $derived(menuConfig[role] || menuConfig.pasien);

	function handleMenuClick(id: string) {
		onMenuSelect(id);
		onClose(); // Otomatis tutup sidebar di HP
	}

	/**
	 * Handle logout: call backend to clear DB token + cookies,
	 * then wipe in-memory auth state and redirect to login.
	 */
	async function handleLogout() {
		try {
			await api.post('/auth/logout');
		} catch {
			// Even if the API call fails (e.g., token already expired),
			// still clear local state and redirect
		}
		clearAuth();
		goto('/login');
	}
</script>

<!-- 2. Svelte 5 Snippets: Tempat menampung elemen UI murni (bebas XSS) -->
{#snippet renderIcon(name: string)}
	{#if name === 'beranda'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-.46-.46V20.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-7.06l-.46.46a.75.75 0 11-1.06-1.06l8.99-9z"
			/></svg
		>
	{:else if name === 'janji'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'resep'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M10.5 3A1.5 1.5 0 009 4.5v1.5H5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h13.5a3 3 0 003-3V9a3 3 0 00-3-3H15V4.5A1.5 1.5 0 0013.5 3h-3zm-1.5 3h6v1.5h-6V6zM9 12a.75.75 0 01.75-.75h1.5v-1.5a.75.75 0 011.5 0v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5A.75.75 0 019 12z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'pengaturan'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.014-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'users'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z"
			/></svg
		>
	{:else if name === 'user-plus'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				d="M6.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM3.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122z"
			/><path
				d="M19.75 7.5a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5H19v-1.5a.75.75 0 01.75-.75z"
			/></svg
		>
	{:else if name === 'building'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M4.5 2.25a.75.75 0 000 1.5v16.5h-.75a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5h-.75V3.75a.75.75 0 000-1.5h-15zM9 6a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9zm-.75 3.75A.75.75 0 019 9h.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM9 12a.75.75 0 000 1.5h.75a.75.75 0 000-1.5H9zm3.75-5.25A.75.75 0 0113.5 6h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM13.5 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zm-.75 3.75a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM9 19.5v-2.25a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v2.25H9z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'key'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M15.75 1.5a6.75 6.75 0 00-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 00-.878 2.121v2.818c0 .414.336.75.75.75H6a.75.75 0 00.75-.75v-1.5h1.5A.75.75 0 009 19.5V18h1.5a.75.75 0 00.53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1015.75 1.5zm0 3a.75.75 0 000 1.5A2.25 2.25 0 0118 8.25a.75.75 0 001.5 0 3.75 3.75 0 00-3.75-3.75z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'database'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				d="M12 2.25c-4.97 0-9 1.68-9 3.75v12c0 2.07 4.03 3.75 9 3.75s9-1.68 9-3.75V6c0-2.07-4.03-3.75-9-3.75zM3 8.69c1.77 1.14 5.13 1.81 9 1.81s7.23-.67 9-1.81V12c0 1.24-4.03 2.25-9 2.25S3 13.24 3 12V8.69zm0 6c1.77 1.14 5.13 1.81 9 1.81s7.23-.67 9-1.81V18c0 1.24-4.03 2.25-9 2.25S3 19.24 3 18v-3.31z"
			/></svg
		>
	{:else if name === 'shield'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M12 1.5a.75.75 0 01.75.75v19.5a.75.75 0 01-1.5 0V2.25A.75.75 0 0112 1.5zM3.604 4.542a.75.75 0 00-.75.75v6.52c0 4.148 2.502 7.72 6.142 9.215a.75.75 0 00.569 0c3.64-1.495 6.142-5.067 6.142-9.215v-6.52a.75.75 0 00-.75-.75h-11.3z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'chart'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z"
				clip-rule="evenodd"
			/><path
				fill-rule="evenodd"
				d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z"
				clip-rule="evenodd"
			/></svg
		>
	{:else if name === 'globe'}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"
			><path
				fill-rule="evenodd"
				d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 18a8.25 8.25 0 01-5.748-14.159c1.688.583 3.513 1.056 5.485 1.408v12.751zm1.5-12.751c1.972-.352 3.797-.825 5.485-1.408A8.25 8.25 0 0113.5 20.25V7.5z"
				clip-rule="evenodd"
			/></svg
		>
	{/if}
{/snippet}

<!-- Overlay Mobile -->
{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
		onclick={onClose}
	></div>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sky-100 bg-white px-5 py-6 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 lg:shadow-none {isOpen
		? 'translate-x-0'
		: '-translate-x-full'}"
>
	<!-- svelte-ignore a11y_consider_explicit_label -->
	<button
		onclick={onClose}
		class="absolute top-7 right-5 text-slate-400 hover:text-sky-700 lg:hidden"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="h-6 w-6"
			><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
		>
	</button>

	<div class="mb-8 px-2">
		<h2 class="text-2xl font-bold text-sky-800">MedSync<span class="text-sky-500">.</span></h2>
		<p class="mt-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">Portal {role}</p>
	</div>

	<nav class="flex flex-1 flex-col gap-2">
		{#each currentMenus as menu (menu.id)}
			<button
				onclick={() => handleMenuClick(menu.id)}
				class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all {activeMenu ===
				menu.id
					? 'bg-sky-50 text-sky-700 shadow-sm'
					: 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}"
			>
				<!-- 3. Memanggil Snippet SVG di sini menggunakan @render -->
				{@render renderIcon(menu.iconName)}

				{menu.label}
			</button>
		{/each}
	</nav>

	<div class="mt-auto border-t border-slate-100 pt-4">
		<button
			onclick={handleLogout}
			class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50"
		>
			<!-- Render ikon "Keluar" secara langsung dan aman -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				class="h-6 w-6"
				><path
					fill-rule="evenodd"
					d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z"
					clip-rule="evenodd"
				/></svg
			>
			Keluar Akun
		</button>
	</div>
</aside>
