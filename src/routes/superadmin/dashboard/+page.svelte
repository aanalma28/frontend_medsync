<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonSuperadmin from '$lib/components/skeleton/DashboardSkeletonSuperadmin.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { departmentStore } from '$lib/stores/department.svelte';

	type DashboardUser = { role: string; name: string; id: string };

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<DashboardUser>({ role: 'superadmin', name: '', id: '' });

	onMount(async () => {
		try {
			const profile = await validateSession();

			// Cek role secara ketat di client-side
			if (profile.role.toLowerCase() !== 'superadmin') {
				isForbidden = true;
			} else {
				currentUser = profile;
			}

			// Panggil API departemen via departmentStore (/departments)
			await departmentStore.fetchDepartments();
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true; // Anggap terlarang jika gagal koneksi/token mati
		} finally {
			isLoading = false;
		}
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// --- DUMMY DATA FOR SUPERADMIN ---
	let branches = $state([
		{
			id: 'BR-JKT',
			name: 'RS Medika Sehat Jakarta',
			status: 'Operasional',
			revenue: 'Rp 2.5B',
			patients: 1250
		},
		{
			id: 'BR-SBY',
			name: 'RS Medika Sehat Surabaya',
			status: 'Operasional',
			revenue: 'Rp 1.8B',
			patients: 950
		},
		{
			id: 'BR-BDG',
			name: 'RS Medika Sehat Bandung',
			status: 'Maintenance',
			revenue: 'Rp 800M',
			patients: 400
		}
	]);

	let allAccounts = $state([
		{
			id: 'SA-001',
			name: 'Rizky Pratama',
			email: 'rizky@medika.com',
			role: 'superadmin',
			branch: 'Pusat',
			status: 'Aktif'
		},
		{
			id: 'ADM-001',
			name: 'Farhan',
			email: 'farhan@medika.com',
			role: 'admin',
			branch: 'Jakarta',
			status: 'Aktif'
		},
		{
			id: 'ADM-002',
			name: 'Lestari',
			email: 'lestari@medika.com',
			role: 'admin',
			branch: 'Surabaya',
			status: 'Aktif'
		},
		{
			id: 'DKT-001',
			name: 'dr. Andi Wijaya',
			email: 'andi.w@medika.com',
			role: 'dokter',
			branch: 'Jakarta',
			status: 'Aktif'
		},
		{
			id: 'APT-001',
			name: 'Siti Nurhaliza',
			email: 'siti.n@medika.com',
			role: 'apoteker',
			branch: 'Bandung',
			status: 'Aktif'
		},
		{
			id: 'PSN-001',
			name: 'Budi Santoso',
			email: 'budi.s@medika.com',
			role: 'pasien',
			branch: '-',
			status: 'Aktif'
		},
		{
			id: 'ADM-003',
			name: 'Bayu',
			email: 'bayu@medika.com',
			role: 'admin',
			branch: 'Bandung',
			status: 'Non-Aktif'
		}
	]);

	// Role filter for the account management table
	let selectedRoleFilter = $state('semua');
	const roleOptions = [
		{ value: 'semua', label: 'Semua Role' },
		{ value: 'superadmin', label: 'Superadmin' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'dokter', label: 'Dokter' },
		{ value: 'apoteker', label: 'Apoteker' },
		{ value: 'pasien', label: 'Pasien' }
	];

	let filteredAccounts = $derived(
		selectedRoleFilter === 'semua'
			? allAccounts
			: allAccounts.filter((a) => a.role === selectedRoleFilter)
	);

	// Helper to display role badge styling
	function getRoleBadgeClass(role: string): string {
		switch (role) {
			case 'superadmin':
				return 'bg-rose-100 text-rose-700';
			case 'admin':
				return 'bg-indigo-100 text-indigo-700';
			case 'dokter':
				return 'bg-sky-100 text-sky-700';
			case 'apoteker':
				return 'bg-amber-100 text-amber-700';
			case 'pasien':
				return 'bg-emerald-100 text-emerald-700';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}

	function getRoleLabel(role: string): string {
		switch (role) {
			case 'superadmin':
				return 'Superadmin';
			case 'admin':
				return 'Admin';
			case 'dokter':
				return 'Dokter';
			case 'apoteker':
				return 'Apoteker';
			case 'pasien':
				return 'Pasien';
			default:
				return role;
		}
	}

	// =============================================
	// TAMBAH USER MODAL — State & Validation
	// =============================================
	let showAddUserModal = $state(false);
	let isAddUserSubmitting = $state(false);
	let addUserBackendError = $state('');
	let isAddUserPasswordFocused = $state(false);

	// Daftar role yang bisa dipilih saat tambah user
	const addUserRoleOptions = [
		{ value: 'pasien', label: 'Pasien' },
		{ value: 'dokter', label: 'Dokter' },
		{ value: 'apoteker', label: 'Apoteker' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'superadmin', label: 'Superadmin' }
	];

	let addUserForm = $state({
		nama: '',
		email: '',
		password: '',
		confirmPassword: '',
		role: 'pasien',
		alamat: '',
		phone: '',
		tanggalLahir: ''
	});

	// --- Real-time Validation (Referensi: AuthShell.svelte) ---
	let isAddNameValid = $derived(addUserForm.nama.length >= 3 && addUserForm.nama.length <= 100);

	let isAddEmailValid = $derived(
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addUserForm.email) && addUserForm.email.length <= 100
	);

	// Pecahan validasi password
	let isAddPwdLength = $derived(
		addUserForm.password.length >= 8 && addUserForm.password.length <= 128
	);
	let isAddPwdUpper = $derived(/[A-Z]/.test(addUserForm.password));
	let isAddPwdLower = $derived(/[a-z]/.test(addUserForm.password));
	let isAddPwdNum = $derived(/\d/.test(addUserForm.password));
	let isAddPasswordValid = $derived(
		isAddPwdLength && isAddPwdUpper && isAddPwdLower && isAddPwdNum
	);

	let isAddConfirmValid = $derived(
		addUserForm.confirmPassword === addUserForm.password && addUserForm.password.length > 0
	);

	let isAddPhoneValid = $derived(
		/^(\+62|62|08)[0-9]{8,13}$/.test(addUserForm.phone.replace(/[\s-]/g, ''))
	);

	let isAddBirthDateValid = $derived(() => {
		if (!addUserForm.tanggalLahir) return false;
		const birth = new Date(addUserForm.tanggalLahir);
		if (isNaN(birth.getTime())) return false;
		const today = new Date();
		let age = today.getFullYear() - birth.getFullYear();
		const monthDiff = today.getMonth() - birth.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
		return age >= 1 && age <= 120;
	});

	let isAddAddressValid = $derived(
		addUserForm.alamat.length >= 10 && addUserForm.alamat.length <= 255
	);

	let isAddRoleValid = $derived(addUserRoleOptions.some((r) => r.value === addUserForm.role));

	// Label alamat dinamis berdasarkan role
	let addressLabel = $derived(
		addUserForm.role === 'pasien' ? 'Alamat tempat tinggal' : 'Alamat tempat kerja'
	);
	let addressPlaceholder = $derived(
		addUserForm.role === 'pasien'
			? 'Jl. Pemuda No. 45, Kudus, Jawa Tengah'
			: 'Jl. RS Medika Sehat No. 12, Jakarta Selatan'
	);
	// Kunci utama: Apakah form tambah user valid untuk di-submit?
	let isAddFormValid = $derived(
		isAddNameValid &&
			isAddEmailValid &&
			isAddPasswordValid &&
			isAddConfirmValid &&
			isAddRoleValid &&
			isAddAddressValid &&
			isAddPhoneValid &&
			isAddBirthDateValid()
	);

	// Mendapatkan tanggal maksimum (hari ini) untuk input tanggal lahir
	function getTodayDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	function openAddUserModal() {
		// Reset form
		addUserForm = {
			nama: '',
			email: '',
			password: '',
			confirmPassword: '',
			role: 'pasien',
			alamat: '',
			phone: '',
			tanggalLahir: ''
		};
		addUserBackendError = '';
		isAddUserSubmitting = false;
		showAddUserModal = true;
	}

	function closeAddUserModal() {
		showAddUserModal = false;
	}

	async function handleAddUserSubmit(event: Event) {
		event.preventDefault();
		addUserBackendError = '';

		if (!isAddFormValid) return;

		isAddUserSubmitting = true;

		try {
			const payload = {
				role: addUserForm.role,
				name: addUserForm.nama,
				email: addUserForm.email,
				phone: addUserForm.phone,
				address: addUserForm.alamat,
				birth_date: addUserForm.tanggalLahir,
				password: addUserForm.password,
				confirm_password: addUserForm.confirmPassword,
				accepted_terms: true
			};

			const response = await fetch(import.meta.env.VITE_API_URL + '/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				// Sukses — tutup modal & bisa refresh data
				alert('User berhasil ditambahkan!');
				closeAddUserModal();
			} else {
				const errorData = await response.json();
				if (Array.isArray(errorData.message)) {
					addUserBackendError = errorData.message.join(' • ');
				} else {
					addUserBackendError = errorData.message || 'Terjadi kesalahan validasi server.';
				}
			}
		} catch {
			addUserBackendError = 'Gagal terhubung ke server. Pastikan backend menyala.';
		} finally {
			isAddUserSubmitting = false;
		}
	}

	// =============================================
	// MANAJEMEN DEPARTEMEN — State & Validation via departmentStore
	// =============================================
	let departments = $derived(departmentStore.list);

	// Search & Selected preview departemen dalam modal Tambah User
	let deptSearchInUserModal = $state('');
	let modalFilteredDepartments = $derived(
		deptSearchInUserModal.trim() === ''
			? departments
			: departments.filter(
					(d) =>
						(d.kode_departmen || d.departmen_code || '').toLowerCase().includes(deptSearchInUserModal.toLowerCase()) ||
						(d.nama_departmen || d.name || '').toLowerCase().includes(deptSearchInUserModal.toLowerCase()) ||
						(d.alamat_departmen || d.address || '').toLowerCase().includes(deptSearchInUserModal.toLowerCase())
				)
	);
	let selectedDept = $derived(
		departments.find(
			(d) => d.alamat_departmen === addUserForm.alamat || d.address === addUserForm.alamat
		)
	);

	let deptSearchQuery = $state('');
	let showDeptModal = $state(false);
	let isEditDept = $state(false);
	let editingDeptId = $state<string | null>(null);
	let isDeptSubmitting = $state(false);
	let deptModalError = $state<string | null>(null);

	let deptForm = $state({
		code: '',
		name: '',
		address: ''
	});

	let showDeleteDeptModal = $state(false);
	let deletingDept = $state<{ id: string; name: string } | null>(null);

	// Form validation matching backend constraints using $derived
	let isDeptCodeValid = $derived(
		/^[A-Za-z0-9_-]{2,50}$/.test(deptForm.code.trim())
	);
	let isDeptNameValid = $derived(
		deptForm.name.trim().length >= 2 && deptForm.name.trim().length <= 100
	);
	let isDeptAddressValid = $derived(
		deptForm.address.trim().length >= 3 && deptForm.address.trim().length <= 500
	);

	let isDeptFormValid = $derived(
		isDeptCodeValid && isDeptNameValid && isDeptAddressValid
	);

	let filteredDepartments = $derived(
		deptSearchQuery.trim() === ''
			? departments
			: departments.filter(
					(d) =>
						(d.departmen_code || d.kode_departmen || '').toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
						(d.name || d.nama_departmen || '').toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
						(d.address || d.alamat_departmen || '').toLowerCase().includes(deptSearchQuery.toLowerCase())
				)
	);

	function openAddDeptModal() {
		deptForm = { code: '', name: '', address: '' };
		isEditDept = false;
		editingDeptId = null;
		deptModalError = null;
		showDeptModal = true;
	}

	function openEditDeptModal(dept: { id: string; id_departmen?: string; code?: string; departmen_code?: string; kode_departmen?: string; name?: string; nama_departmen?: string; address?: string; alamat_departmen?: string }) {
		deptForm = {
			code: dept.departmen_code || dept.kode_departmen || dept.code || '',
			name: dept.name || dept.nama_departmen || '',
			address: dept.address || dept.alamat_departmen || ''
		};
		isEditDept = true;
		editingDeptId = dept.id || dept.id_departmen || '';
		deptModalError = null;
		showDeptModal = true;
	}

	function closeDeptModal() {
		showDeptModal = false;
		deptModalError = null;
	}

	async function handleSaveDept(event: Event) {
		event.preventDefault();
		if (!isDeptFormValid || isDeptSubmitting) return;

		isDeptSubmitting = true;
		deptModalError = null;

		const cleanCode = deptForm.code.trim().toUpperCase();
		const cleanName = deptForm.name.trim();
		const cleanAddress = deptForm.address.trim();

		try {
			if (isEditDept && editingDeptId) {
				await departmentStore.updateDepartment(editingDeptId, {
					departmen_code: cleanCode,
					name: cleanName,
					address: cleanAddress
				});
			} else {
				await departmentStore.createDepartment({
					departmen_code: cleanCode,
					name: cleanName,
					address: cleanAddress
				});
			}
			closeDeptModal();
		} catch (err: any) {
			console.error('Gagal menyimpan departemen:', err);
			deptModalError = err?.message || 'Gagal menyimpan departemen';
		} finally {
			isDeptSubmitting = false;
		}
	}

	function openDeleteDeptModal(dept: { id: string; id_departmen?: string; name?: string; nama_departmen?: string }) {
		deletingDept = { id: dept.id || dept.id_departmen || '', name: dept.nama_departmen || dept.name || '' };
		showDeleteDeptModal = true;
	}

	async function confirmDeleteDept() {
		if (deletingDept && !isDeptSubmitting) {
			isDeptSubmitting = true;
			try {
				await departmentStore.deleteDepartment(deletingDept.id);
			} catch (err) {
				console.error('Gagal menghapus departemen:', err);
			} finally {
				isDeptSubmitting = false;
				deletingDept = null;
			}
		}
		showDeleteDeptModal = false;
	}
</script>

<Title title="Superadmin | Dashboard" />

<div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if isForbidden}
		<div></div>
	{:else}
		<Sidebar
			role="superadmin"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={(m) => (activeMenu = m)}
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
					class="text-slate-700"
					aria-label="Buka menu navigasi"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="h-7 w-7"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
						/></svg
					>
				</button>
				<div class="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
					Superadmin: {currentUser.id}
				</div>
			</header>
		{/if}

		<div class={!isForbidden ? 'flex-1 overflow-y-auto px-5 py-6 md:px-8 lg:px-10 lg:py-10' : ''}>
			{#if isLoading}
				<DashboardSkeletonSuperadmin />
			{:else if isForbidden}
				<ErrorState status={403} />
			{:else}
				<!-- HIGHLIGHT BANNER: SUPERADMIN -->
				<div
					class="relative mb-8 overflow-hidden rounded-[24px] bg-slate-900 p-6 text-white shadow-xl sm:p-8"
				>
					<div
						class="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"
					></div>
					<div class="absolute right-0 bottom-0 opacity-5">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-48 w-48"
							><path
								fill-rule="evenodd"
								d="M12 1.5a.75.75 0 01.75.75v19.5a.75.75 0 01-1.5 0V2.25A.75.75 0 0112 1.5zM3.604 4.542a.75.75 0 00-.75.75v6.52c0 4.148 2.502 7.72 6.142 9.215a.75.75 0 00.569 0c3.64-1.495 6.142-5.067 6.142-9.215v-6.52a.75.75 0 00-.75-.75h-11.3z"
								clip-rule="evenodd"
							/></svg
						>
					</div>

					<div
						class="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
					>
						<div>
							<div class="mb-3 flex items-center gap-2">
								<span class="relative flex h-2.5 w-2.5">
									<span
										class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"
									></span>
									<span
										class="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
									></span>
								</span>
								<p class="text-[11px] font-bold tracking-widest text-slate-300 uppercase">
									Akses Strategis
								</p>
							</div>
							<h1 class="text-3xl font-black sm:text-4xl">Dashboard Strategis 🌐</h1>
							<p class="mt-2 text-sm text-slate-400 sm:text-base">
								Pengawasan lintas cabang, analitik bisnis, dan konfigurasi sistem inti.
							</p>
						</div>
					</div>
				</div>

				<!-- BERANDA SUPERADMIN -->
				{#if activeMenu === 'beranda'}
					<section class="mb-6 grid gap-4 sm:grid-cols-4">
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Cabang</p>
							<p class="mt-3 text-3xl font-black text-slate-900">{branches.length}</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">100% Online</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Pasien (Global)</p>
							<p class="mt-3 text-3xl font-black text-slate-900">2,600</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">+15% Bulan ini</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Akun Terdaftar</p>
							<p class="mt-3 text-3xl font-black text-slate-900">{allAccounts.length}</p>
							<p class="mt-1 text-xs font-semibold text-slate-500">Semua role</p>
						</div>
						<div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
							<p class="text-sm font-bold text-indigo-800">Pendapatan (Bulan Ini)</p>
							<p class="mt-3 text-3xl font-black text-indigo-900">Rp 5.1B</p>
						</div>
					</section>

					<div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
						<!-- Chart Area -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<div class="mb-8 flex items-center justify-between">
								<div>
									<h2 class="text-xl font-bold text-slate-900">Grafik Kunjungan Pasien</h2>
									<p class="text-sm text-slate-500">Agregasi dari seluruh cabang</p>
								</div>
								<select
									class="appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 pl-3 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
									style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.5em 1.5em;"
								>
									<option>Bulan Ini</option>
									<option>Tahun Ini</option>
								</select>
							</div>

							<div class="mt-8 flex h-64 items-end justify-between gap-2">
								<!-- Dummy Bar Chart -->
								{#each [40, 70, 45, 90, 65, 85, 100] as height, i}
									<div
										class="group relative flex h-full w-full cursor-pointer flex-col justify-end"
									>
										<div
											class="w-full rounded-t-lg bg-indigo-100 transition-all group-hover:bg-indigo-200"
											style="height: {height}%"
										>
											<div
												class="absolute -top-8 w-full text-center text-xs font-bold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100"
											>
												{height * 12}
											</div>
										</div>
									</div>
								{/each}
							</div>
							<div
								class="mt-2 flex justify-start text-xs font-semibold text-slate-400 md:justify-between"
							>
								<span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span
								><span>Sab</span><span>Min</span>
							</div>
						</section>

						<!-- List Cabang -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<h2 class="mb-4 text-xl font-bold text-slate-900">Status Cabang</h2>
							<ul class="space-y-4">
								{#each branches as branch}
									<li class="flex items-center justify-between border-b border-slate-50 pb-3">
										<div>
											<h3 class="font-bold text-slate-800">{branch.name}</h3>
											<p class="text-xs text-slate-500">Pendapatan: {branch.revenue}</p>
										</div>
										<span
											class={`rounded-md px-2 py-1 text-[10px] font-black tracking-wider uppercase ${branch.status === 'Operasional' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
										>
											{branch.status}
										</span>
									</li>
								{/each}
							</ul>
						</section>
					</div>

					<!-- MANAJEMEN AKUN -->
				{:else if activeMenu === 'admin-mgmt'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Akun</h2>
								<p class="text-sm text-slate-500">
									Kelola seluruh akun pengguna di semua role dalam sistem.
								</p>
							</div>
							<div class="flex items-center gap-3">
								<select
									bind:value={selectedRoleFilter}
									class="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 pr-10 text-sm font-semibold text-slate-700 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
									style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.5em 1.5em;"
								>
									{#each roleOptions as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
								<button
									onclick={openAddUserModal}
									class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
									>+ Tambah Akun</button
								>
							</div>
						</div>

						<!-- Summary Cards -->
						<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
							{#each roleOptions.filter((r) => r.value !== 'semua') as roleOpt}
								<button
									onclick={() =>
										(selectedRoleFilter =
											selectedRoleFilter === roleOpt.value ? 'semua' : roleOpt.value)}
									class="rounded-xl border p-3 text-left transition {selectedRoleFilter ===
									roleOpt.value
										? 'border-indigo-300 bg-indigo-50 shadow-sm'
										: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
								>
									<p class="text-2xl font-black text-slate-900">
										{allAccounts.filter((a) => a.role === roleOpt.value).length}
									</p>
									<p class="mt-1 text-xs font-semibold text-slate-500">{roleOpt.label}</p>
								</button>
							{/each}
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-sm">
								<thead class="bg-slate-50 text-slate-500">
									<tr>
										<th class="rounded-tl-lg px-4 py-3 font-semibold">ID</th>
										<th class="px-4 py-3 font-semibold">Nama / Email</th>
										<th class="px-4 py-3 font-semibold">Role</th>
										<th class="px-4 py-3 font-semibold">Cabang</th>
										<th class="px-4 py-3 font-semibold">Status</th>
										<th class="rounded-tr-lg px-4 py-3 text-right font-semibold">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredAccounts as account}
										<tr class="transition hover:bg-slate-50">
											<td class="px-4 py-3 font-bold text-slate-900">{account.id}</td>
											<td class="px-4 py-3">
												<p class="font-bold text-slate-800">{account.name}</p>
												<p class="text-xs text-slate-500">{account.email}</p>
											</td>
											<td class="px-4 py-3">
												<span
													class={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${getRoleBadgeClass(account.role)}`}
													>{getRoleLabel(account.role)}</span
												>
											</td>
											<td class="px-4 py-3 text-slate-600">{account.branch}</td>
											<td class="px-4 py-3">
												<span
													class={`rounded-full px-2.5 py-1 text-[10px] font-bold ${account.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
													>{account.status}</span
												>
											</td>
											<td class="px-4 py-3 text-right">
												<button class="mr-3 font-bold text-sky-600 hover:underline">Edit</button>
												{#if account.status === 'Aktif'}
													<button class="font-bold text-amber-600 hover:underline"
														>Nonaktifkan</button
													>
												{:else}
													<button class="font-bold text-emerald-600 hover:underline"
														>Aktifkan</button
													>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>

							{#if filteredAccounts.length === 0}
								<div class="py-12 text-center">
									<p class="text-sm font-semibold text-slate-400">
										Tidak ada akun ditemukan untuk filter ini.
									</p>
								</div>
							{/if}
						</div>
					</section>

					<!-- MANAJEMEN DEPARTEMEN -->
				{:else if activeMenu === 'departemen'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Departemen</h2>
								<p class="text-sm text-slate-500">
									Kelola daftar departemen, poli, dan unit pelayanan kesehatan.
								</p>
							</div>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
								<div class="relative">
									<input
										type="text"
										bind:value={deptSearchQuery}
										placeholder="Cari kode/nama/alamat..."
										class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-64"
									/>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="absolute top-2.5 left-3 h-4 w-4 text-slate-400"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
										/>
									</svg>
								</div>
								<button
									onclick={openAddDeptModal}
									class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
								>
									+ Tambah Departemen
								</button>
							</div>
						</div>

						<!-- Summary Cards -->
						<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-xs font-semibold text-slate-500">Total Departemen</p>
								<p class="mt-1 text-2xl font-black text-slate-900">{departments.length}</p>
							</div>
							<div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
								<p class="text-xs font-semibold text-indigo-700">Hasil Pencarian</p>
								<p class="mt-1 text-2xl font-black text-indigo-900">{filteredDepartments.length}</p>
							</div>
							<div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
								<p class="text-xs font-semibold text-emerald-700">Status Layanan</p>
								<p class="mt-1 text-2xl font-black text-emerald-900">Aktif & Operasional</p>
							</div>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-sm">
								<thead class="bg-slate-50 text-slate-500">
									<tr>
										<th class="rounded-tl-lg px-4 py-3 font-semibold">Kode Departemen</th>
										<th class="px-4 py-3 font-semibold">Nama Departemen</th>
										<th class="px-4 py-3 font-semibold">Alamat Departemen</th>
										<th class="rounded-tr-lg px-4 py-3 text-right font-semibold">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredDepartments as dept}
										<tr class="transition hover:bg-slate-50">
											<td class="px-4 py-3">
												<span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
													{dept.departmen_code || dept.kode_departmen}
												</span>
											</td>
											<td class="px-4 py-3 font-bold text-slate-800">{dept.nama_departmen || dept.name}</td>
											<td class="px-4 py-3 text-slate-600 max-w-xs truncate">{dept.alamat_departmen || dept.address}</td>
											<td class="px-4 py-3 text-right">
												<button
													onclick={() => openEditDeptModal(dept)}
													class="mr-3 font-bold text-sky-600 hover:underline"
												>
													Edit
												</button>
												<button
													onclick={() => openDeleteDeptModal(dept)}
													class="font-bold text-rose-600 hover:underline"
												>
													Hapus
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>

							{#if filteredDepartments.length === 0}
								<div class="py-12 text-center">
									<p class="text-sm font-semibold text-slate-400">
										Tidak ada departemen ditemukan.
									</p>
								</div>
							{/if}
						</div>
					</section>

					<!-- LAPORAN FINANSIAL -->
				{:else if activeMenu === 'reports'}
					<section
						class="rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-sm"
					>
						<h2 class="mb-2 text-xl font-bold text-slate-900">Laporan Finansial & Bisnis</h2>
						<div class="py-12">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="mx-auto mb-4 h-16 w-16 text-slate-300"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
								/></svg
							>
							<p class="font-bold text-slate-700">Modul Rekap Finansial (TBA)</p>
							<p class="mt-2 text-sm text-slate-500">
								Integrasi dengan sistem payment gateway sedang diproses.
							</p>
							<button
								class="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
								>Ekspor Data Sementara (CSV)</button
							>
						</div>
					</section>

					<!-- PENGATURAN GLOBAL -->
				{:else if activeMenu === 'settings'}
					<section class="max-w-3xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<h2 class="mb-6 text-xl font-bold text-slate-900">Pengaturan Sistem Global</h2>

						<div class="space-y-6 divide-y divide-slate-100">
							<!-- Backup -->
							<div class="flex items-center justify-between pb-4">
								<div>
									<p class="font-bold text-slate-800">Backup Database Terjadwal</p>
									<p class="mt-1 text-sm text-slate-500">
										Lakukan backup otomatis setiap jam 02:00 AM
									</p>
								</div>
								<!-- Toggle -->
								<label for="toggle1" class="mr-2 flex cursor-pointer items-center">
									<div class="relative">
										<input type="checkbox" id="toggle1" class="peer sr-only" checked />
										<div
											class="block h-6 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500"
										></div>
										<div
											class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"
										></div>
									</div>
								</label>
							</div>

							<!-- Maintenance -->
							<div class="flex items-center justify-between pt-4 pb-4">
								<div>
									<p class="font-bold text-slate-800">Mode Perawatan (Maintenance Mode)</p>
									<p class="mt-1 text-sm text-slate-500">
										Hanya Superadmin yang dapat login, user lain akan melihat halaman perbaikan.
									</p>
								</div>
								<label for="toggle2" class="mr-2 flex cursor-pointer items-center">
									<div class="relative">
										<input type="checkbox" id="toggle2" class="peer sr-only" />
										<div
											class="block h-6 w-12 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500"
										></div>
										<div
											class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-6"
										></div>
									</div>
								</label>
							</div>

							<!-- Log retention -->
							<div class="pt-4">
								<label class="block">
									<span class="mb-1.5 block text-sm font-bold text-slate-700"
										>Retensi Log Sistem (Hari)</span
									>
									<input
										type="number"
										value="30"
										class="w-full max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
									/>
								</label>
								<button
									class="mt-4 rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-800"
									>Simpan Pengaturan</button
								>
							</div>
						</div>
					</section>
				{/if}
			{/if}
		</div>
	</main>
</div>

<!-- ========================================= -->
<!-- MODAL: TAMBAH USER BARU                   -->
<!-- ========================================= -->
{#if showAddUserModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
		onclick={(e) => { if (e.target === e.currentTarget) closeAddUserModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeAddUserModal(); }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Tambah user baru"
	>
		<div
			class="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
		>
			<!-- Close Button -->
			<button
				onclick={closeAddUserModal}
				class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
				aria-label="Tutup modal"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900">Tambah User Baru</h2>
					<p class="text-sm text-slate-500">Buat akun pengguna dengan role spesifik</p>
				</div>
			</div>

			<!-- Backend Error Banner -->
			{#if addUserBackendError}
				<div class="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm">
					<div class="flex gap-3">
						<span class="text-lg">⚠️</span>
						<div>
							<strong class="block font-semibold">Terdapat Kesalahan:</strong>
							<span class="mt-1 block">{addUserBackendError}</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Form -->
			<form class="space-y-4" onsubmit={handleAddUserSubmit}>
				<!-- Nama -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Nama lengkap</span>
					<input
						bind:value={addUserForm.nama}
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Nama pengguna baru"
					/>
					{#if addUserForm.nama.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isAddNameValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Email -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Email</span>
					<input
						bind:value={addUserForm.email}
						type="email"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="user@rumahsakit.com"
					/>
					{#if addUserForm.email.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isAddEmailValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Password -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Kata sandi</span>
					<input
						bind:value={addUserForm.password}
						type="password"
						onfocus={() => (isAddUserPasswordFocused = true)}
						onblur={() => (isAddUserPasswordFocused = false)}
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Minimal 8 karakter"
					/>
					{#if addUserForm.password.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isAddPasswordValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Password Checklist Dropdown -->
				{#if isAddUserPasswordFocused}
					<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm transition-all duration-300">
						<p class="mb-1.5 font-medium text-slate-700">Syarat kata sandi:</p>
						<ul class="space-y-1">
							<li class="flex items-center gap-1.5 {isAddPwdLength ? 'text-green-600' : 'text-slate-500'}">
								<span>{isAddPwdLength ? '✅' : '❌'}</span> Minimal 8 karakter
							</li>
							<li class="flex items-center gap-1.5 {isAddPwdUpper ? 'text-green-600' : 'text-slate-500'}">
								<span>{isAddPwdUpper ? '✅' : '❌'}</span> Minimal 1 huruf kapital
							</li>
							<li class="flex items-center gap-1.5 {isAddPwdLower ? 'text-green-600' : 'text-slate-500'}">
								<span>{isAddPwdLower ? '✅' : '❌'}</span> Minimal 1 huruf kecil
							</li>
							<li class="flex items-center gap-1.5 {isAddPwdNum ? 'text-green-600' : 'text-slate-500'}">
								<span>{isAddPwdNum ? '✅' : '❌'}</span> Minimal 1 angka
							</li>
						</ul>
					</div>
				{/if}

				<!-- Repeat Password -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Konfirmasi kata sandi</span>
					<input
						bind:value={addUserForm.confirmPassword}
						type="password"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Ulangi kata sandi"
					/>
					{#if addUserForm.confirmPassword.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isAddConfirmValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Role -->
				<label class="block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Role</span>
					<select
						bind:value={addUserForm.role}
						class="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.75rem center; background-size: 1.25em 1.25em;"
					>
						{#each addUserRoleOptions as roleOpt}
							<option value={roleOpt.value}>{roleOpt.label}</option>
						{/each}
					</select>
				</label>

				<!-- Phone & Tanggal Lahir (2 kolom) -->
				<div class="grid gap-4 sm:grid-cols-2">
					<label class="relative block text-sm font-medium text-slate-700">
						<span class="mb-2 block">Nomor handphone</span>
						<input
							bind:value={addUserForm.phone}
							type="tel"
							class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
							placeholder="0812-3456-7890"
						/>
						{#if addUserForm.phone.length > 0}
							<span class="absolute top-10 right-3 text-sm">{isAddPhoneValid ? '✅' : '❌'}</span>
						{/if}
					</label>

					<label class="relative block text-sm font-medium text-slate-700">
						<span class="mb-2 block">Tanggal lahir</span>
						<input
							bind:value={addUserForm.tanggalLahir}
							type="date"
							max={getTodayDate()}
							class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						/>
						{#if addUserForm.tanggalLahir.length > 0}
							<span class="absolute top-10 right-10 text-sm">{isAddBirthDateValid() ? '✅' : '❌'}</span>
						{/if}
					</label>
				</div>

				<!-- Alamat (Textarea untuk Pasien, Option Select dari API/Data Departemen untuk Staff) -->
				{#if addUserForm.role === 'pasien'}
					<label class="relative block text-sm font-medium text-slate-700">
						<span class="mb-2 block">{addressLabel}</span>
						<textarea
							bind:value={addUserForm.alamat}
							rows="2"
							class="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
							placeholder={addressPlaceholder}></textarea>
						{#if addUserForm.alamat.length > 0}
							<span class="absolute top-10 right-3 text-sm">{isAddAddressValid ? '✅' : '❌'}</span>
						{/if}
					</label>
				{:else}
					<!-- Interactive Department Selector (Anti-Human Error UI) -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-slate-700">
								{addressLabel} <span class="font-bold text-indigo-600">(Pilih Departemen Tempat Kerja)</span>
							</span>
							{#if departments.length > 2}
								<input
									type="text"
									bind:value={deptSearchInUserModal}
									placeholder="Cari departemen..."
									class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none focus:border-indigo-500 focus:bg-white"
								/>
							{/if}
						</div>

						<!-- Grid Card Departemen -->
						<div class="grid max-h-52 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
							{#each modalFilteredDepartments as dept}
								{@const isSelected =
									addUserForm.alamat === dept.alamat_departmen ||
									addUserForm.alamat === dept.address}
								<button
									type="button"
									onclick={() => (addUserForm.alamat = dept.alamat_departmen || dept.address)}
									class="relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-200 {isSelected
										? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-500/20'
										: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}"
								>
									<div class="flex items-start justify-between gap-2">
										<span
											class="rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase {isSelected
												? 'bg-indigo-600 text-white'
												: 'border border-slate-200 bg-slate-100 text-slate-700'}"
										>
											{dept.kode_departmen}
										</span>
										<div
											class="flex h-5 w-5 items-center justify-center rounded-full text-xs transition {isSelected
												? 'bg-indigo-600 text-white'
												: 'border border-slate-300 text-transparent hover:border-slate-400'}"
										>
											✓
										</div>
									</div>

									<div class="mt-2">
										<p class="text-sm font-bold leading-snug text-slate-900">{dept.nama_departmen}</p>
										<p class="mt-1 flex items-start gap-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
											<span class="shrink-0 text-slate-400">📍</span>
											<span>{dept.alamat_departmen}</span>
										</p>
									</div>
								</button>
							{/each}
						</div>

						<!-- Selected Department Confirmation Banner -->
						{#if selectedDept}
							<div
								class="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-3.5 shadow-sm"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"
								>
									🏢
								</div>
								<div class="flex-1 text-xs">
									<div class="flex items-center justify-between">
										<p class="font-bold text-indigo-950">Departemen Penugasan Terpilih</p>
										<span
											class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
											>✓ Siap Ditugaskan</span
										>
									</div>
									<p class="mt-0.5 font-bold text-indigo-800">
										{selectedDept.nama_departmen} ({selectedDept.kode_departmen})
									</p>
									<p class="mt-0.5 text-slate-600">{selectedDept.alamat_departmen}</p>
								</div>
							</div>
						{:else}
							<div
								class="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800"
							>
								<span class="text-base">⚠️</span>
								<span class="font-medium"
									>Silakan klik salah satu kartu departemen di atas untuk memilih alamat tempat kerja staf.</span
								>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Validation Checklist -->
				<div
					class="rounded-2xl border {isAddFormValid
						? 'border-green-300 bg-green-50/50'
						: 'border-slate-200 bg-white/60'} p-4 text-sm transition-all"
				>
					<p class="mb-2 font-medium text-slate-700">Status Validasi Formulir</p>
					<ul class="grid gap-1.5 text-xs sm:grid-cols-2">
						<li class="flex items-center gap-2 {isAddNameValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddNameValid ? '✅' : '❌'}</span> Nama (3-100 karakter)
						</li>
						<li class="flex items-center gap-2 {isAddEmailValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddEmailValid ? '✅' : '❌'}</span> Format email valid
						</li>
						<li class="flex items-center gap-2 {isAddPasswordValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddPasswordValid ? '✅' : '❌'}</span> Kata sandi memenuhi syarat
						</li>
						<li class="flex items-center gap-2 {isAddConfirmValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddConfirmValid ? '✅' : '❌'}</span> Konfirmasi sandi cocok
						</li>
						<li class="flex items-center gap-2 {isAddRoleValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddRoleValid ? '✅' : '❌'}</span> Role dipilih
						</li>
						<li class="flex items-center gap-2 {isAddPhoneValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddPhoneValid ? '✅' : '❌'}</span> No. HP format Indonesia
						</li>
						<li class="flex items-center gap-2 {isAddBirthDateValid() ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddBirthDateValid() ? '✅' : '❌'}</span> Tanggal lahir valid (1-120 tahun)
						</li>
						<li class="flex items-center gap-2 {isAddAddressValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isAddAddressValid ? '✅' : '❌'}</span>
							{addUserForm.role === 'pasien' ? 'Alamat tempat tinggal (min. 10 karakter)' : 'Departemen tempat kerja dipilih'}
						</li>
					</ul>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeAddUserModal}
						class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={!isAddFormValid || isAddUserSubmitting}
						class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isAddUserSubmitting ? 'Memproses...' : 'Tambah User'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ========================================= -->
<!-- MODAL: TAMBAH / EDIT DEPARTEMEN           -->
<!-- ========================================= -->
{#if showDeptModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
		onclick={(e) => { if (e.target === e.currentTarget) closeDeptModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeDeptModal(); }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label={isEditDept ? 'Edit departemen' : 'Tambah departemen baru'}
	>
		<div
			class="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
		>
			<!-- Close Button -->
			<button
				onclick={closeDeptModal}
				class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
				aria-label="Tutup modal"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.75m-.75 3h.75m-.75 3h.75" />
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900">{isEditDept ? 'Edit Departemen' : 'Tambah Departemen Baru'}</h2>
					<p class="text-sm text-slate-500">{isEditDept ? 'Perbarui informasi departemen' : 'Daftarkan departemen atau unit pelayanan baru'}</p>
				</div>
			</div>

			<!-- Form -->
			<form class="space-y-4" onsubmit={handleSaveDept}>
				{#if deptModalError}
					<div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
						⚠️ {deptModalError}
					</div>
				{/if}

				<!-- Kode Departemen -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Kode Departemen</span>
					<input
						bind:value={deptForm.code}
						type="text"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 uppercase"
						placeholder="DPT-POLI-UMUM"
					/>
					{#if deptForm.code.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isDeptCodeValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Nama Departemen -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Nama Departemen</span>
					<input
						bind:value={deptForm.name}
						type="text"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Poli Umum"
					/>
					{#if deptForm.name.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isDeptNameValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Alamat Departemen -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Alamat Departemen</span>
					<textarea
						bind:value={deptForm.address}
						rows="3"
						class="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Gedung Utama Lantai 1, RS Medika Sehat Jakarta"
					></textarea>
					{#if deptForm.address.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isDeptAddressValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Validation Checklist -->
				<div
					class="rounded-2xl border {isDeptFormValid
						? 'border-green-300 bg-green-50/50'
						: 'border-slate-200 bg-white/60'} p-4 text-sm transition-all"
				>
					<p class="mb-2 font-medium text-slate-700">Status Validasi Formulir</p>
					<ul class="space-y-1.5 text-xs">
						<li class="flex items-center gap-2 {isDeptCodeValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isDeptCodeValid ? '✅' : '❌'}</span> Kode Departemen valid (3-20 karakter, alfanumerik & tanda hubung)
						</li>
						<li class="flex items-center gap-2 {isDeptNameValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isDeptNameValid ? '✅' : '❌'}</span> Nama Departemen terisi dengan benar (3-100 karakter)
						</li>
						<li class="flex items-center gap-2 {isDeptAddressValid ? 'text-green-600' : 'text-slate-500'}">
							<span>{isDeptAddressValid ? '✅' : '❌'}</span> Alamat Departemen terisi dengan benar (min. 10 karakter)
						</li>
					</ul>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={closeDeptModal}
						class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={!isDeptFormValid}
						class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isEditDept ? 'Simpan Perubahan' : 'Tambah Departemen'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ========================================= -->
<!-- MODAL: HAPUS DEPARTEMEN                   -->
<!-- ========================================= -->
{#if showDeleteDeptModal && deletingDept}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
		onclick={(e) => { if (e.target === e.currentTarget) showDeleteDeptModal = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') showDeleteDeptModal = false; }}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Konfirmasi hapus departemen"
	>
		<div class="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
			<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
				</svg>
			</div>

			<h3 class="text-lg font-bold text-slate-900">Hapus Departemen?</h3>
			<p class="mt-2 text-sm text-slate-600">
				Apakah Anda yakin ingin menghapus departemen <strong class="text-slate-900">{deletingDept.name}</strong>? Tindakan ini tidak dapat dibatalkan.
			</p>

			<div class="mt-6 flex gap-3">
				<button
					type="button"
					onclick={() => (showDeleteDeptModal = false)}
					class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
				>
					Batal
				</button>
				<button
					type="button"
					onclick={confirmDeleteDept}
					class="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700"
				>
					Hapus
				</button>
			</div>
		</div>
	</div>
{/if}
