<script lang="ts">
// @ts-nocheck
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Title from '$lib/components/Title.svelte';
	import { onMount } from 'svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import DashboardSkeletonSuperadmin from '$lib/components/skeleton/DashboardSkeletonSuperadmin.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import { departmentStore } from '$lib/stores/department.svelte';
	import { userStore, type UserItem, type UpdateUserPayload } from '$lib/stores/user.svelte';
	import { hospitalStore, type Hospital, type CreateHospitalPayload, type UpdateHospitalPayload } from '$lib/stores/hospital.svelte';

	type DashboardUser = { role: string; name: string; id: string; user_code?: string };

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let currentUser = $state<DashboardUser>({ role: 'superadmin', name: '', id: '', user_code: '' });

	onMount(async () => {
		try {
			const profile = await validateSession();

			// Cek role secara ketat di client-side
			if (profile.role.toLowerCase() !== 'superadmin') {
				isForbidden = true;
			} else {
				currentUser = profile;
			}

			// Panggil API hospital (/hospitals), departemen (/departments), dan user (/users)
			await Promise.all([hospitalStore.fetchHospitals(), departmentStore.fetchDepartments(), userStore.fetchUsers()]);
		} catch (err) {
			console.error('Gagal verifikasi sesi:', err);
			isForbidden = true; // Anggap terlarang jika gagal koneksi/token mati
		} finally {
			isLoading = false;
		}
	});

	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);

	// --- DATA USERS DARI BACKEND SERVICE (/users) ---
	let allAccounts = $derived(userStore.list);

	// Role & Status filters for the account management table
	let selectedRoleFilter = $state('semua');
	const roleOptions = [
		{ value: 'semua', label: 'Semua Role' },
		{ value: 'superadmin', label: 'Superadmin' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'dokter', label: 'Dokter' },
		{ value: 'apoteker', label: 'Apoteker' },
		{ value: 'pasien', label: 'Pasien' }
	];

	let selectedStatusFilter = $state<'semua' | 'aktif' | 'nonaktif'>('semua');
	const statusOptions = [
		{ value: 'semua', label: 'Semua Status' },
		{ value: 'aktif', label: '✅ Aktif' },
		{ value: 'nonaktif', label: '❌ Non-Aktif' }
	];

	let filteredAccounts = $derived.by(() => {
		// 1. Filter berdasarkan Role & Status
		const filtered = allAccounts.filter((a) => {
			const matchesRole = selectedRoleFilter === 'semua' || a.role === selectedRoleFilter;
			const matchesStatus =
				selectedStatusFilter === 'semua'
					? true
					: selectedStatusFilter === 'aktif'
						? a.is_active
						: !a.is_active;
			return matchesRole && matchesStatus;
		});

		// 2. Urutkan: Aktif duluan, kemudian berdasarkan tanggal pembuatan (createdAt) terbaru
		return filtered.slice().sort((a, b) => {
			// Prioritas 1: User Aktif (true) mendahului Non-aktif (false)
			if (a.is_active !== b.is_active) {
				return a.is_active ? -1 : 1;
			}

			// Prioritas 2: Tanggal pembuatan (createdAt) terbaru (descending)
			const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
			const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
			if (timeA !== timeB) {
				return timeB - timeA;
			}

			return (b.id || '').localeCompare(a.id || '');
		});
	});

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
		{ value: 'OWNER', label: 'Owner' },
		{ value: 'SUPERADMIN', label: 'Superadmin' },
		{ value: 'MASTERADMIN', label: 'Masteradmin' },
		{ value: 'REGISTER_ADMIN', label: 'Register Admin' },
		{ value: 'GENERAL_DOCTOR', label: 'Dokter Umum' },
		{ value: 'SPECIALIST_DOCTOR', label: 'Dokter Spesialis' },
		{ value: 'PHARMACIST', label: 'Apoteker' },
		{ value: 'NURSE', label: 'Perawat' },
		{ value: 'PATIENT', label: 'Pasien' }
	];

	let addUserForm = $state({
		nama: '',
		email: '',
		password: '',
		confirmPassword: '',
		role: 'PATIENT',
		alamat: '',
		phone: '',
		tanggalLahir: '',
		departmenId: '',
		gender: '',
		age: '',
		alergi_obat: '',
		familyMembers: [] as Array<{ name: string; gender?: string; age?: number; alergi_obat?: string }>
	});

	// --- Real-time Validation ---
	let isAddNameValid = $derived(addUserForm.nama.length >= 3 && addUserForm.nama.length <= 100);

	let isAddEmailValid = $derived(
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addUserForm.email) && addUserForm.email.length <= 100
	);

	// Pecahan validasi password
	let isAddPwdLength = $derived(
		addUserForm.password.length >= 6 && addUserForm.password.length <= 128
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
		addUserForm.role === 'PATIENT'
			? addUserForm.alamat.length >= 10 && addUserForm.alamat.length <= 255
			: Boolean(addUserForm.departmenId)
	);

	let isAddRoleValid = $derived(addUserRoleOptions.some((r) => r.value === addUserForm.role));

	// Label alamat dinamis berdasarkan role
	let addressLabel = $derived(
		addUserForm.role === 'PATIENT' ? 'Alamat tempat tinggal' : 'Alamat tempat kerja'
	);
	let addressPlaceholder = $derived(
		addUserForm.role === 'PATIENT'
			? 'Jl. Pemuda No. 45, Kudus, Jawa Tengah'
			: 'Jl. RS Medika Sehat No. 12, Jakarta Selatan'
	);

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
			role: 'PATIENT',
			alamat: '',
			phone: '',
			tanggalLahir: '',
			departmenId: '',
			gender: '',
			age: '',
			alergi_obat: '',
			familyMembers: []
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
			if (addUserForm.role === 'PATIENT') {
				await userStore.createPatient({
					name: addUserForm.nama,
					email: addUserForm.email,
					password: addUserForm.password,
					phone: addUserForm.phone,
					address: addUserForm.alamat,
					birth_date: addUserForm.tanggalLahir,
					accepted_terms: true,
					family_members: addUserForm.familyMembers && addUserForm.familyMembers.length ? addUserForm.familyMembers : undefined
				});
			} else {
				// For staff and admin roles, send role as-is (backend expects uppercase enum names)
				await userStore.createStaff({
					name: addUserForm.nama,
					email: addUserForm.email,
					password: addUserForm.password,
					role: addUserForm.role,
					departmen_id: addUserForm.departmenId,
					phone: addUserForm.phone,
					address: addUserForm.alamat || undefined,
					birth_date: addUserForm.tanggalLahir
				});
			}

			alert('Akun user berhasil dibuat!');
			closeAddUserModal();
			await userStore.fetchUsers();
		} catch (err: any) {
			addUserBackendError = err?.message || 'Terjadi kesalahan validasi server.';
		} finally {
			isAddUserSubmitting = false;
		}
	}

	// =============================================
	// GET SPECIFIC USER DETAIL & EDIT MODAL
	// =============================================
	let showUserDetailModal = $state(false);
	let isFetchingUserDetail = $state(false);
	let selectedUserDetail = $state<UserItem | null>(null);

	let isEditUserMode = $state(false);
	let isEditUserSubmitting = $state(false);
	let editUserBackendError = $state<string | null>(null);

	let editDeptSearch = $state('');

	let editUserForm = $state({
		name: '',
		email: '',
		password: '',
		phone: '',
		birthDate: '',
		address: '',
		departmenId: '',
		is_active: true
	});

	// Derived validation rules for Edit User Form
	let isEditNameValid = $derived(
		editUserForm.name.trim().length >= 3 && editUserForm.name.trim().length <= 100
	);
	let isEditEmailValid = $derived(
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUserForm.email.trim()) &&
			editUserForm.email.trim().length <= 100
	);
	let isEditPasswordValid = $derived(
		editUserForm.password.trim() === '' ||
			(editUserForm.password.trim().length >= 6 && editUserForm.password.trim().length <= 128)
	);
	let isEditPhoneValid = $derived(
		editUserForm.phone.trim() === '' ||
			/^(\+62|62|08)[0-9]{8,13}$/.test(editUserForm.phone.replace(/[\s-]/g, ''))
	);
	let isEditBirthDateValid = $derived(() => {
		if (!editUserForm.birthDate) return true;
		const birth = new Date(editUserForm.birthDate);
		if (isNaN(birth.getTime())) return false;
		const today = new Date();
		let age = today.getFullYear() - birth.getFullYear();
		const monthDiff = today.getMonth() - birth.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
		return age >= 1 && age <= 120;
	});
	let isEditAddressValid = $derived(
		selectedUserDetail?.role === 'pasien'
			? editUserForm.address.trim().length === 0 || editUserForm.address.trim().length >= 10
			: Boolean(editUserForm.departmenId)
	);
	let isEditFormValid = $derived(
		isEditNameValid &&
			isEditEmailValid &&
			isEditPasswordValid &&
			isEditPhoneValid &&
			isEditBirthDateValid() &&
			isEditAddressValid
	);

	async function openUserDetail(id: string, autoEdit = false) {
		isFetchingUserDetail = true;
		showUserDetailModal = true;
		selectedUserDetail = null;
		isEditUserMode = false;
		editUserBackendError = null;

		try {
			const detail = await userStore.getUserById(id);
			selectedUserDetail = detail;
			if (autoEdit && detail) {
				startEditingUser();
			}
		} catch (err) {
			console.error('Gagal mengambil detail user:', err);
		} finally {
			isFetchingUserDetail = false;
		}
	}

	function closeUserDetailModal() {
		showUserDetailModal = false;
		selectedUserDetail = null;
		isEditUserMode = false;
		editUserBackendError = null;
	}

	function startEditingUser() {
		if (!selectedUserDetail) return;
		let defaultDeptId = selectedUserDetail.employeeUser?.departmen_id || '';
		if (!defaultDeptId && selectedUserDetail.employeeUser?.departmen?.id) {
			defaultDeptId = selectedUserDetail.employeeUser.departmen.id;
		}

		editUserForm = {
			name: selectedUserDetail.name || '',
			email: selectedUserDetail.email || '',
			password: '',
			phone: selectedUserDetail.phone || '',
			birthDate: selectedUserDetail.birth_date ? selectedUserDetail.birth_date.split('T')[0] : '',
			address: selectedUserDetail.address || '',
			departmenId: defaultDeptId,
			is_active: selectedUserDetail.is_active ?? true
		};
		editDeptSearch = '';
		editUserBackendError = null;
		isEditUserMode = true;
	}

	function cancelEditingUser() {
		isEditUserMode = false;
		editUserBackendError = null;
	}

	async function handleSaveUserEdit(event: Event) {
		event.preventDefault();
		if (!selectedUserDetail || isEditUserSubmitting || !isEditFormValid) return;

		isEditUserSubmitting = true;
		editUserBackendError = null;

		try {
			const payload: UpdateUserPayload = {
				name: editUserForm.name.trim(),
				email: editUserForm.email.trim(),
				phone: editUserForm.phone.trim() || undefined,
				address: editUserForm.address.trim() || undefined,
				birth_date: editUserForm.birthDate || undefined,
				is_active: editUserForm.is_active
			};

			if (editUserForm.password.trim().length > 0) {
				if (editUserForm.password.trim().length < 6) {
					throw new Error('Password baru minimal 6 karakter');
				}
				payload.password = editUserForm.password.trim();
			}

			if (selectedUserDetail.employeeUser && editUserForm.departmenId) {
				payload.departmen_id = editUserForm.departmenId;
			}

			await userStore.updateUser(selectedUserDetail.id, payload);

			// Refresh list & single item detail
			await userStore.fetchUsers();
			const updatedDetail = await userStore.getUserById(selectedUserDetail.id);
			if (updatedDetail) {
				selectedUserDetail = updatedDetail;
			}

			alert('Data user berhasil diperbarui!');
			isEditUserMode = false;
		} catch (err: any) {
			console.error('Gagal mengedit user:', err);
			editUserBackendError = err?.message || 'Gagal memperbarui data user.';
		} finally {
			isEditUserSubmitting = false;
		}
	}

	async function handleToggleUserStatus(account: UserItem) {
		try {
			if (account.is_active) {
				await userStore.deleteUser(account.id);
			} else {
				await userStore.updateUser(account.id, { is_active: true });
			}
			await userStore.fetchUsers();
		} catch (err: any) {
			alert(err?.message || 'Gagal mengubah status user');
		}
	}

	// =============================================
	// MANAJEMEN DEPARTEMEN — State & Validation
	// =============================================
	let departments = departmentStore.list;

	let deptSearchInUserModal = $state('');

	// Debug toggle to inspect raw department data when troubleshooting
	// helper: check if a department matches the selected role's desired category
	function deptMatchesRole(d, role) {
		if (!role) return true;
		// roles that should filter by department category
		let desiredCategory = null;
		if (String(role).includes('ADMIN')) desiredCategory = 'ADMIN';
		else if (role === 'GENERAL_DOCTOR') desiredCategory = 'GENERALIST';
		else if (role === 'SPECIALIST_DOCTOR') desiredCategory = 'SPECIALIST';
		else if (role === 'PHARMACIST') desiredCategory = 'PHARMACY';
		else if (role === 'NURSE') desiredCategory = 'NURSING';

		if (!desiredCategory) return true; // no filtering for this role

		const rawCat = d.category ?? d.kategori ?? '';
		const catStr = String(rawCat || '').toUpperCase();
		if (!catStr) return false;

		if (catStr.includes('ADMIN') && desiredCategory === 'ADMIN') return true;
		if (catStr.includes('GENERAL') && desiredCategory === 'GENERALIST') return true;
		if (catStr.includes('SPECIAL') && desiredCategory === 'SPECIALIST') return true;
		if (catStr.includes('PHARM') && desiredCategory === 'PHARMACY') return true;
		if (catStr.includes('NURS') && desiredCategory === 'NURSING') return true;

		return catStr === desiredCategory;
	}

	function handleRoleChange() {
		const role = addUserForm.role;
		// if role hides departments, clear selection
		if (!role || role === 'PATIENT' || role === 'SUPERADMIN' || role === 'OWNER') {
			addUserForm.departmenId = '';
			return;
		}

		// find currently selected dept
		const sel = departmentStore.list.find((d) => d.id === addUserForm.departmenId || d.id_departmen === addUserForm.departmenId);
		if (!sel) return;
		// if selected dept doesn't match new role, reset it
		if (!deptMatchesRole(sel, role)) {
			addUserForm.departmenId = '';
		}
	}

	let deptSearchQuery = $state('');
	let deptStatusFilter = $state<'all' | 'active' | 'inactive'>('all');
	let showDeptModal = $state(false);
	let isEditDept = $state(false);
	let editingDeptId = $state<string | null>(null);
	let isDeptSubmitting = $state(false);
	let deptModalError = $state<string | null>(null);

	let deptForm = $state({
		code: '',
		name: '',
		city: '',
		address: '',
		is_active: true
	});

	let isDeptCodeValid = $derived(/^[A-Za-z0-9_-]{2,50}$/.test(deptForm.code.trim()));
	let isDeptNameValid = $derived(
		deptForm.name.trim().length >= 2 && deptForm.name.trim().length <= 100
	);
	let isDeptAddressValid = $derived(
		deptForm.address.trim().length >= 3 && deptForm.address.trim().length <= 500
	);

	let isDeptFormValid = $derived(isDeptCodeValid && isDeptNameValid && isDeptAddressValid);

	let filteredDepartments = $derived(
		departments
			.filter((d) => {
				const matchesSearch =
					deptSearchQuery.trim() === '' ||
					(d.departmen_code || d.kode_departmen || '')
						.toLowerCase()
						.includes(deptSearchQuery.toLowerCase()) ||
					(d.name || d.nama_departmen || '')
						.toLowerCase()
						.includes(deptSearchQuery.toLowerCase()) ||
					(d.city || '').toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
					(d.address || d.alamat_departmen || '')
						.toLowerCase()
						.includes(deptSearchQuery.toLowerCase());

				const isDeptActive = d.is_active !== false;
				const matchesStatus =
					deptStatusFilter === 'all' ||
					(deptStatusFilter === 'active' && isDeptActive) ||
					(deptStatusFilter === 'inactive' && !isDeptActive);

				return matchesSearch && matchesStatus;
			})
			.sort((a, b) => {
				const aActive = a.is_active !== false ? 1 : 0;
				const bActive = b.is_active !== false ? 1 : 0;
				if (aActive !== bActive) return bActive - aActive;
				return (a.name || '').localeCompare(b.name || '');
			})
	);

	function openAddDeptModal() {
		deptForm = { code: '', name: '', city: '', address: '', is_active: true };
		isEditDept = false;
		editingDeptId = null;
		deptModalError = null;
		showDeptModal = true;
	}

	function openEditDeptModal(dept: {
		id: string;
		id_departmen?: string;
		code?: string;
		departmen_code?: string;
		kode_departmen?: string;
		name?: string;
		nama_departmen?: string;
		city?: string;
		address?: string;
		alamat_departmen?: string;
		is_active?: boolean;
	}) {
		deptForm = {
			code: dept.departmen_code || dept.kode_departmen || dept.code || '',
			name: dept.name || dept.nama_departmen || '',
			city: dept.city || '',
			address: dept.address || dept.alamat_departmen || '',
			is_active: dept.is_active !== false
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
		const cleanCity = deptForm.city.trim();
		const cleanAddress = deptForm.address.trim();

		try {
			if (isEditDept && editingDeptId) {
				await departmentStore.updateDepartment(editingDeptId, {
					departmen_code: cleanCode,
					name: cleanName,
					city: cleanCity || undefined,
					address: cleanAddress,
					is_active: deptForm.is_active
				});
			} else {
				await departmentStore.createDepartment({
					departmen_code: cleanCode,
					name: cleanName,
					city: cleanCity || undefined,
					address: cleanAddress,
					is_active: deptForm.is_active
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

	async function handleToggleDeptStatus(dept: {
		id: string;
		id_departmen?: string;
		is_active?: boolean;
		name?: string;
		nama_departmen?: string;
	}) {
		const deptId = dept.id || dept.id_departmen || '';
		if (!deptId || isDeptSubmitting) return;

		const currentlyActive = dept.is_active !== false;
		const actionText = currentlyActive ? 'menonaktifkan' : 'mengaktifkan';
		const deptName = dept.nama_departmen || dept.name || 'Departemen';

		if (!confirm(`Apakah Anda yakin ingin ${actionText} departemen "${deptName}"?`)) {
			return;
		}

		isDeptSubmitting = true;
		try {
			if (currentlyActive) {
				await departmentStore.deleteDepartment(deptId);
			} else {
				await departmentStore.updateDepartment(deptId, { is_active: true });
			}
		} catch (err: any) {
			console.error(`Gagal ${actionText} departemen:`, err);
			alert(err?.message || `Gagal ${actionText} departemen.`);
		} finally {
			isDeptSubmitting = false;
		}
	}

	// =============================================
	// MANAJEMEN RUMAH SAKIT — State & Validation
	// =============================================
	let hospitals = $derived(hospitalStore.list);

	let hospitalSearchQuery = $state('');
	let hospitalStatusFilter = $state<'all' | 'active' | 'inactive'>('all');
	let hospitalPage = $state(1);
	let hospitalLimit = $state(10);

	let filteredHospitals = $derived(
		hospitals
			.filter((h) => {
				const search = hospitalSearchQuery.trim().toLowerCase();
				const matchesSearch =
					search === '' ||
					(h.hospital_code || h.kode_hospital || '').toLowerCase().includes(search) ||
					(h.name || h.nama_hospital || '').toLowerCase().includes(search) ||
					(h.address || h.alamat_hospital || '').toLowerCase().includes(search) ||
					(h.owner?.name || '').toLowerCase().includes(search);

				const isHospActive = h.is_active !== false;
				const matchesStatus =
					hospitalStatusFilter === 'all' ||
					(hospitalStatusFilter === 'active' && isHospActive) ||
					(hospitalStatusFilter === 'inactive' && !isHospActive);

				return matchesSearch && matchesStatus;
			})
			.sort((a, b) => {
				const aActive = a.is_active !== false ? 1 : 0;
				const bActive = b.is_active !== false ? 1 : 0;
				if (aActive !== bActive) return bActive - aActive;
				return (a.name || '').localeCompare(b.name || '');
			})
	);

	let paginatedHospitals = $derived(
		filteredHospitals.slice((hospitalPage - 1) * hospitalLimit, hospitalPage * hospitalLimit)
	);
	let hospitalTotalPages = $derived(Math.ceil(filteredHospitals.length / hospitalLimit) || 1);

	// Modal Form State (Tambah / Edit RS)
	let showHospitalModal = $state(false);
	let isEditHospital = $state(false);
	let editingHospitalId = $state<string | null>(null);
	let isHospitalSubmitting = $state(false);
	let hospitalModalError = $state<string | null>(null);

	let hospitalForm = $state({
		code: '',
		name: '',
		address: '',
		user_id: '',
		is_active: true
	});

	// Form Real-time Validation
	let isHospitalCodeValid = $derived(/^[A-Za-z0-9_-]{2,50}$/.test(hospitalForm.code.trim()));
	let isHospitalNameValid = $derived(
		hospitalForm.name.trim().length >= 2 && hospitalForm.name.trim().length <= 150
	);
	let isHospitalAddressValid = $derived(
		hospitalForm.address.trim().length >= 3 && hospitalForm.address.trim().length <= 500
	);
	let isHospitalFormValid = $derived(
		isHospitalCodeValid && isHospitalNameValid && isHospitalAddressValid
	);

	// Detail Modal State
	let showHospitalDetailModal = $state(false);
	let isFetchingHospitalDetail = $state(false);
	let selectedHospitalDetail = $state<Hospital | null>(null);

	// Cascading Soft Delete Alert Modal State
	let showHospitalDeleteModal = $state(false);
	let deletingHospital = $state<Hospital | null>(null);
	let isHospitalDeleting = $state(false);
	let hospitalDeleteError = $state<string | null>(null);

	function openAddHospitalModal() {
		hospitalForm = {
			code: '',
			name: '',
			address: '',
			user_id: currentUser.id || '',
			is_active: true
		};
		isEditHospital = false;
		editingHospitalId = null;
		hospitalModalError = null;
		showHospitalModal = true;
	}

	function openEditHospitalModal(hosp: Hospital) {
		hospitalForm = {
			code: hosp.hospital_code || hosp.kode_hospital || '',
			name: hosp.name || hosp.nama_hospital || '',
			address: hosp.address || hosp.alamat_hospital || '',
			user_id: hosp.user_id || hosp.owner?.id || currentUser.id || '',
			is_active: hosp.is_active !== false
		};
		isEditHospital = true;
		editingHospitalId = hosp.id;
		hospitalModalError = null;
		showHospitalModal = true;
	}

	function closeHospitalModal() {
		showHospitalModal = false;
		hospitalModalError = null;
	}

	async function handleSaveHospital(event: Event) {
		event.preventDefault();
		if (!isHospitalFormValid || isHospitalSubmitting) return;

		isHospitalSubmitting = true;
		hospitalModalError = null;

		const cleanCode = hospitalForm.code.trim().toUpperCase();
		const cleanName = hospitalForm.name.trim();
		const cleanAddress = hospitalForm.address.trim();
		const cleanUserId = hospitalForm.user_id || currentUser.id;

		try {
			if (isEditHospital && editingHospitalId) {
				await hospitalStore.updateHospital(editingHospitalId, {
					hospital_code: cleanCode,
					name: cleanName,
					address: cleanAddress,
					user_id: cleanUserId || undefined,
					is_active: hospitalForm.is_active
				});
			} else {
				await hospitalStore.createHospital({
					hospital_code: cleanCode,
					name: cleanName,
					address: cleanAddress,
					user_id: cleanUserId || undefined
				});
			}
			closeHospitalModal();
			await hospitalStore.fetchHospitals();
		} catch (err: any) {
			console.error('Gagal menyimpan rumah sakit:', err);
			hospitalModalError = err?.message || 'Gagal menyimpan rumah sakit';
		} finally {
			isHospitalSubmitting = false;
		}
	}

	async function openHospitalDetail(id: string) {
		isFetchingHospitalDetail = true;
		showHospitalDetailModal = true;
		selectedHospitalDetail = null;

		try {
			const detail = await hospitalStore.getHospitalById(id);
			selectedHospitalDetail = detail;
		} catch (err) {
			console.error('Gagal mengambil detail rumah sakit:', err);
		} finally {
			isFetchingHospitalDetail = false;
		}
	}

	function closeHospitalDetailModal() {
		showHospitalDetailModal = false;
		selectedHospitalDetail = null;
	}

	function openDeleteHospitalModal(hospital: Hospital) {
		deletingHospital = hospital;
		hospitalDeleteError = null;
		showHospitalDeleteModal = true;
	}

	function closeDeleteHospitalModal() {
		showHospitalDeleteModal = false;
		deletingHospital = null;
		hospitalDeleteError = null;
	}

	async function confirmDeleteHospital() {
		if (!deletingHospital || isHospitalDeleting) return;

		isHospitalDeleting = true;
		hospitalDeleteError = null;

		try {
			await hospitalStore.deleteHospital(deletingHospital.id);
			await Promise.all([
				hospitalStore.fetchHospitals(),
				departmentStore.fetchDepartments(),
				userStore.fetchUsers()
			]);
			closeDeleteHospitalModal();
		} catch (err: any) {
			console.error('Gagal menonaktifkan rumah sakit:', err);
			hospitalDeleteError = err?.message || 'Gagal menonaktifkan rumah sakit';
		} finally {
			isHospitalDeleting = false;
		}
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
					Superadmin: {currentUser.user_code || currentUser.id}
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
								Pengawasan lintas unit, analitik bisnis, dan manajemen pengguna sistem.
							</p>
						</div>
					</div>
				</div>

				<!-- BERANDA SUPERADMIN -->
				{#if activeMenu === 'beranda'}
					<section class="mb-6 grid gap-4 sm:grid-cols-4">
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Departemen</p>
							<p class="mt-3 text-3xl font-black text-slate-900">{departments.length}</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">100% Aktif</p>
						</div>
						<div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<p class="text-sm font-bold text-slate-600">Total Pasien</p>
							<p class="mt-3 text-3xl font-black text-slate-900">
								{allAccounts.filter((a) => a.role === 'pasien').length}
							</p>
							<p class="mt-1 text-xs font-semibold text-emerald-500">Terdaftar di Sistem</p>
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
									<p class="text-sm text-slate-500">Agregasi dari seluruh unit</p>
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
								{#each [40, 70, 45, 90, 65, 85, 100] as height (height)}
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

						<!-- List Departemen Ringkas -->
						<section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
							<h2 class="mb-4 text-xl font-bold text-slate-900">Status Departemen</h2>
							<ul class="space-y-4">
								{#each departments as dept (dept.id || dept.departmen_code)}
									<li class="flex items-center justify-between border-b border-slate-50 pb-3">
										<div>
											<h3 class="font-bold text-slate-800">{dept.name || dept.nama_departmen}</h3>
											<p class="text-xs text-slate-500">
												Kode: {dept.departmen_code || dept.kode_departmen}
											</p>
										</div>
										{#if dept.is_active !== false}
											<span
												class="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-700 uppercase"
											>
												Aktif
											</span>
										{:else}
											<span
												class="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black tracking-wider text-slate-600 uppercase"
											>
												Non-Aktif
											</span>
										{/if}
									</li>
								{/each}
							</ul>
						</section>
					</div>

					<!-- MANAJEMEN RUMAH SAKIT & KLINIK -->
				{:else if activeMenu === 'hospitals'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Rumah Sakit & Klinik</h2>
								<p class="text-sm text-slate-500">
									Kelola daftar rumah sakit, klinik, cabang, serta instansi penyedia layanan kesehatan.
								</p>
							</div>
							<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
								<!-- Dropdown Filter Status RS -->
								<select
									bind:value={hospitalStatusFilter}
									class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
								>
									<option value="all">Semua Status</option>
									<option value="active">Aktif Sahaja</option>
									<option value="inactive">Non-Aktif Sahaja</option>
								</select>
								<!-- Search Input -->
								<div class="relative">
									<input
										type="text"
										bind:value={hospitalSearchQuery}
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
									onclick={openAddHospitalModal}
									class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
								>
									+ Tambah Rumah Sakit
								</button>
							</div>
						</div>

						<!-- Summary Cards RS -->
						<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p class="text-xs font-semibold text-slate-500">Total Rumah Sakit / Klinik</p>
								<p class="mt-1 text-2xl font-black text-slate-900">{hospitals.length}</p>
							</div>
							<div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
								<p class="text-xs font-semibold text-emerald-700">Rumah Sakit Aktif</p>
								<p class="mt-1 text-2xl font-black text-emerald-900">
									{hospitals.filter((h) => h.is_active !== false).length}
								</p>
							</div>
							<div class="rounded-xl border border-slate-200 bg-slate-100 p-4">
								<p class="text-xs font-semibold text-slate-600">Rumah Sakit Non-Aktif</p>
								<p class="mt-1 text-2xl font-black text-slate-700">
									{hospitals.filter((h) => h.is_active === false).length}
								</p>
							</div>
						</div>

						<!-- Mobile Card View RS -->
						<div class="block space-y-3 md:hidden">
							{#each paginatedHospitals as hosp (hosp.id)}
								<div
									class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-200"
								>
									<div class="flex items-center justify-between border-b border-slate-100 pb-3">
										<span
											class="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700"
										>
											{hosp.hospital_code || hosp.kode_hospital}
										</span>
										{#if hosp.is_active !== false}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Aktif
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Non-Aktif
											</span>
										{/if}
									</div>

									<div class="mt-3 space-y-1">
										<h3 class="font-bold text-slate-900">{hosp.name || hosp.nama_hospital}</h3>
										<p class="text-xs text-slate-500 line-clamp-2">
											📍 {hosp.address || hosp.alamat_hospital || '-'}
										</p>
										<div class="flex items-center gap-4 text-xs text-slate-500 pt-1">
											<span>👤 Owner: {hosp.owner?.name || 'Superadmin'}</span>
											<span>🏥 Dept: {hosp.department_count ?? 0}</span>
										</div>
									</div>

									<div class="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
										<button
											onclick={() => openHospitalDetail(hosp.id)}
											class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
										>
											Detail
										</button>
										<button
											onclick={() => openEditHospitalModal(hosp)}
											class="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
										>
											Edit
										</button>
										{#if hosp.is_active !== false}
											<button
												onclick={() => openDeleteHospitalModal(hosp)}
												class="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
											>
												Soft Delete
											</button>
										{/if}
									</div>
								</div>
							{:else}
								<div class="rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
									Tidak ada rumah sakit/klinik ditemukan.
								</div>
							{/each}
						</div>

						<!-- Desktop Table View RS -->
						<div class="hidden overflow-x-auto md:block">
							<table class="w-full text-left text-sm text-slate-600">
								<thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
									<tr>
										<th class="rounded-l-xl px-4 py-3">Kode RS</th>
										<th class="px-4 py-3">Nama Rumah Sakit / Klinik</th>
										<th class="px-4 py-3">Alamat</th>
										<th class="px-4 py-3">Pemilik / Owner</th>
										<th class="px-4 py-3">Jumlah Dept</th>
										<th class="px-4 py-3">Status</th>
										<th class="rounded-r-xl px-4 py-3 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each paginatedHospitals as hosp (hosp.id)}
										<tr class="transition hover:bg-slate-50/80">
											<td class="px-4 py-3.5 font-mono text-xs font-bold text-indigo-700">
												{hosp.hospital_code || hosp.kode_hospital}
											</td>
											<td class="px-4 py-3.5 font-bold text-slate-900">
												{hosp.name || hosp.nama_hospital}
											</td>
											<td class="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate">
												{hosp.address || hosp.alamat_hospital || '-'}
											</td>
											<td class="px-4 py-3.5 text-xs font-medium text-slate-700">
												{hosp.owner?.name || 'Superadmin'}
											</td>
											<td class="px-4 py-3.5 text-xs font-bold text-slate-700">
												{hosp.department_count ?? 0} Unit
											</td>
											<td class="px-4 py-3.5">
												{#if hosp.is_active !== false}
													<span
														class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700"
													>
														<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Aktif
													</span>
												{:else}
													<span
														class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600"
													>
														<span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Non-Aktif
													</span>
												{/if}
											</td>
											<td class="px-4 py-3.5 text-right">
												<div class="inline-flex items-center gap-1.5">
													<button
														onclick={() => openHospitalDetail(hosp.id)}
														class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
														title="Lihat Detail RS"
													>
														Detail
													</button>
													<button
														onclick={() => openEditHospitalModal(hosp)}
														class="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
														title="Edit RS"
													>
														Edit
													</button>
													{#if hosp.is_active !== false}
														<button
															onclick={() => openDeleteHospitalModal(hosp)}
															class="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
															title="Nonaktifkan RS (Soft Delete)"
														>
															Soft Delete
														</button>
													{/if}
												</div>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="7" class="py-8 text-center text-slate-400">
												Tidak ada data rumah sakit/klinik yang sesuai.
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination Footer RS -->
						{#if hospitalTotalPages > 1}
							<div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
								<p class="text-xs text-slate-500">
									Halaman <span class="font-bold">{hospitalPage}</span> dari <span class="font-bold">{hospitalTotalPages}</span>
								</p>
								<div class="flex items-center gap-2">
									<button
										disabled={hospitalPage <= 1}
										onclick={() => (hospitalPage -= 1)}
										class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
									>
										Sebelumnya
									</button>
									<button
										disabled={hospitalPage >= hospitalTotalPages}
										onclick={() => (hospitalPage += 1)}
										class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
									>
										Selanjutnya
									</button>
								</div>
							</div>
						{/if}
					</section>

					<!-- MANAJEMEN AKUN -->
				{:else if activeMenu === 'admin-mgmt'}
					<section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 class="text-xl font-bold text-slate-900">Manajemen Akun</h2>
								<p class="text-sm text-slate-500">
									Kelola seluruh akun pengguna di semua role dalam sistem MedSync.
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2.5 sm:gap-3">
								<!-- Filter Role -->
								<select
									bind:value={selectedRoleFilter}
									class="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pr-9 text-sm font-semibold text-slate-700 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
									style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.5em 1.5em;"
								>
									{#each roleOptions as opt (opt.value)}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>

								<!-- Filter Status -->
								<select
									bind:value={selectedStatusFilter}
									class="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pr-9 text-sm font-semibold text-slate-700 transition outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
									style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1.5em 1.5em;"
								>
									{#each statusOptions as sOpt (sOpt.value)}
										<option value={sOpt.value}>{sOpt.label}</option>
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
							{#each roleOptions.filter((r) => r.value !== 'semua') as roleOpt (roleOpt.value)}
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

						<!-- Mobile Card View (Responsif untuk HP/Tablet kecil) -->
						<div class="block space-y-3 md:hidden">
							{#each filteredAccounts as account (account.id)}
								<div
									class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-200"
								>
									<!-- Card Header: ID, Role, Status -->
									<div class="flex items-center justify-between border-b border-slate-100 pb-3">
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs font-black text-slate-900"
												>{account.displayId || account.id}</span
											>
											<span
												class={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${getRoleBadgeClass(account.role)}`}
											>
												{getRoleLabel(account.role)}
											</span>
										</div>
										{#if account.is_active}
											<span
												class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-600/20"
											>
												<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
												Aktif
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-600/20"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
												Non-Aktif
											</span>
										{/if}
									</div>

									<!-- Card Body: User Info -->
									<div class="my-3 space-y-1">
										<p class="text-sm font-bold text-slate-900">{account.name}</p>
										<p class="flex items-center gap-1.5 truncate text-xs text-slate-500">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
												class="h-3.5 w-3.5 shrink-0 text-slate-400"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
												/>
											</svg>
											<span class="truncate">{account.email}</span>
										</p>
										{#if account.branch && account.branch !== '-'}
											<p class="flex items-center gap-1.5 pt-0.5 text-xs text-slate-600">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="h-3.5 w-3.5 shrink-0 text-indigo-500"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.75m-.75 3h.75m-.75 3h.75"
													/>
												</svg>
												<span>{account.branch}</span>
											</p>
										{/if}
									</div>

									<!-- Card Footer: Action Buttons Grid -->
									<div class="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-3">
										<button
											onclick={() => openUserDetail(account.id, false)}
											class="flex items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 active:scale-95"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="2"
												stroke="currentColor"
												class="h-3.5 w-3.5"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.573 16.49 16.638 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
												/>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												/>
											</svg>
											<span>Detail</span>
										</button>
										<button
											onclick={() => openUserDetail(account.id, true)}
											class="flex items-center justify-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="2"
												stroke="currentColor"
												class="h-3.5 w-3.5"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
												/>
											</svg>
											<span>Edit</span>
										</button>

										{#if account.is_active}
											<button
												onclick={() => handleToggleUserStatus(account)}
												class="flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="2"
													stroke="currentColor"
													class="h-3.5 w-3.5"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
													/>
												</svg>
												<span>Nonaktif</span>
											</button>
										{:else}
											<button
												onclick={() => handleToggleUserStatus(account)}
												class="flex items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="2"
													stroke="currentColor"
													class="h-3.5 w-3.5"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<span>Aktifkan</span>
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Desktop Table View -->
						<div class="hidden overflow-x-auto md:block">
							<table class="w-full text-left text-sm">
								<thead class="bg-slate-50 text-slate-500">
									<tr>
										<th class="rounded-tl-lg px-4 py-3.5 font-semibold whitespace-nowrap"
											>ID / Kode</th
										>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Nama / Email</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Role</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Departemen</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Status</th>
										<th class="rounded-tr-lg px-4 py-3.5 text-right font-semibold whitespace-nowrap"
											>Aksi</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredAccounts as account (account.id)}
										<tr class="transition hover:bg-slate-50/80">
											<td
												class="px-4 py-3.5 font-mono text-xs font-bold whitespace-nowrap text-slate-900"
											>
												{account.displayId || account.id}
											</td>
											<td class="px-4 py-3.5">
												<p class="font-bold text-slate-800">{account.name}</p>
												<p class="text-xs text-slate-500">{account.email}</p>
											</td>
											<td class="px-4 py-3.5 whitespace-nowrap">
												<span
													class={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase ${getRoleBadgeClass(account.role)}`}
												>
													{getRoleLabel(account.role)}
												</span>
											</td>
											<td class="px-4 py-3.5 font-medium whitespace-nowrap text-slate-600"
												>{account.branch || '-'}</td
											>

											<!-- Polished Status Column -->
											<td class="px-4 py-3.5 whitespace-nowrap">
												{#if account.is_active}
													<span
														class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20"
													>
														<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
														></span>
														Aktif
													</span>
												{:else}
													<span
														class="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-600/20"
													>
														<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
														Non-Aktif
													</span>
												{/if}
											</td>

											<!-- Polished Action Buttons Column -->
											<td class="px-4 py-3.5 text-right whitespace-nowrap">
												<div class="inline-flex items-center justify-end gap-2">
													<button
														onclick={() => openUserDetail(account.id, false)}
														class="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 shadow-2xs transition hover:border-sky-300 hover:bg-sky-100 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
														title="Lihat Detail Akun"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
															stroke-width="2"
															stroke="currentColor"
															class="h-3.5 w-3.5"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.573 16.49 16.638 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
															/>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															/>
														</svg>
														<span>Detail</span>
													</button>
													<button
														onclick={() => openUserDetail(account.id, true)}
														class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
														title="Edit Data User"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
															stroke-width="2"
															stroke="currentColor"
															class="h-3.5 w-3.5"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
															/>
														</svg>
														<span>Edit</span>
													</button>

													{#if account.is_active}
														<button
															onclick={() => handleToggleUserStatus(account)}
															class="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-2xs transition hover:border-amber-300 hover:bg-amber-100 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
															title="Nonaktifkan Akun"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="2"
																stroke="currentColor"
																class="h-3.5 w-3.5"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
																/>
															</svg>
															<span>Nonaktifkan</span>
														</button>
													{:else}
														<button
															onclick={() => handleToggleUserStatus(account)}
															class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
															title="Aktifkan Akun"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="2"
																stroke="currentColor"
																class="h-3.5 w-3.5"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
																/>
															</svg>
															<span>Aktifkan</span>
														</button>
													{/if}
												</div>
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
								<!-- Dropdown Filter Status Departemen -->
								<select
									bind:value={deptStatusFilter}
									class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
								>
									<option value="all">Semua Status</option>
									<option value="active">Aktif Sahaja</option>
									<option value="inactive">Non-Aktif Sahaja</option>
								</select>
								<!-- Search Input -->
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
							<div class="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
								<p class="text-xs font-semibold text-emerald-700">Departemen Aktif</p>
								<p class="mt-1 text-2xl font-black text-emerald-900">
									{departments.filter((d) => d.is_active !== false).length}
								</p>
							</div>
							<div class="rounded-xl border border-slate-200 bg-slate-100 p-4">
								<p class="text-xs font-semibold text-slate-600">Departemen Non-Aktif</p>
								<p class="mt-1 text-2xl font-black text-slate-700">
									{departments.filter((d) => d.is_active === false).length}
								</p>
							</div>
						</div>

						<!-- Mobile Card View Departemen -->
						<div class="block space-y-3 md:hidden">
							{#each filteredDepartments as dept (dept.id)}
								<div
									class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-200"
								>
									<div class="flex items-center justify-between border-b border-slate-100 pb-3">
										<span
											class="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700"
										>
											{dept.departmen_code || dept.kode_departmen}
										</span>
										{#if dept.is_active !== false}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Aktif
											</span>
										{:else}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600"
											>
												<span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Non-Aktif
											</span>
										{/if}
									</div>
									<div class="my-3 space-y-1">
										<h3 class="text-sm font-bold text-slate-900">
											{dept.nama_departmen || dept.name}
										</h3>
										{#if dept.city}
											<p class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="1.5"
													stroke="currentColor"
													class="h-3.5 w-3.5 shrink-0"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.75m-.75 3h.75m-.75 3h.75"
													/>
												</svg>
												<span>Cabang {dept.city}</span>
											</p>
										{/if}
										<p class="flex items-start gap-1 text-xs text-slate-500">
											<span class="shrink-0 text-slate-400">📍</span>
											<span>{dept.alamat_departmen || dept.address}</span>
										</p>
									</div>
									<div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
										<button
											onclick={() => openEditDeptModal(dept)}
											class="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="2"
												stroke="currentColor"
												class="h-3.5 w-3.5"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
												/>
											</svg>
											<span>Edit</span>
										</button>

										{#if dept.is_active !== false}
											<button
												onclick={() => handleToggleDeptStatus(dept)}
												class="flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 active:scale-95"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="2"
													stroke="currentColor"
													class="h-3.5 w-3.5"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
													/>
												</svg>
												<span>Nonaktifkan</span>
											</button>
										{:else}
											<button
												onclick={() => handleToggleDeptStatus(dept)}
												class="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													stroke-width="2"
													stroke="currentColor"
													class="h-3.5 w-3.5"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
												<span>Aktifkan</span>
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>

						<!-- Desktop Table View Departemen -->
						<div class="hidden overflow-x-auto md:block">
							<table class="w-full text-left text-sm">
								<thead class="bg-slate-50 text-slate-500">
									<tr>
										<th class="rounded-tl-lg px-4 py-3.5 font-semibold whitespace-nowrap"
											>Kode Departemen</th
										>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Nama Departemen</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Cabang / Kota</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Status</th>
										<th class="px-4 py-3.5 font-semibold whitespace-nowrap">Alamat Departemen</th>
										<th class="rounded-tr-lg px-4 py-3.5 text-right font-semibold whitespace-nowrap"
											>Aksi</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredDepartments as dept (dept.id)}
										<tr
											class="transition hover:bg-slate-50/80 {dept.is_active === false
												? 'bg-slate-50/40 opacity-75'
												: ''}"
										>
											<td class="px-4 py-3.5 whitespace-nowrap">
												<span
													class="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
												>
													{dept.departmen_code || dept.kode_departmen}
												</span>
											</td>
											<td class="px-4 py-3.5 font-bold whitespace-nowrap text-slate-800"
												>{dept.nama_departmen || dept.name}</td
											>
											<td class="px-4 py-3.5 font-semibold whitespace-nowrap text-indigo-900"
												>{dept.city || '-'}</td
											>
											<td class="px-4 py-3.5 whitespace-nowrap">
												{#if dept.is_active !== false}
													<span
														class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
													>
														<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
														Aktif
													</span>
												{:else}
													<span
														class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
													>
														<span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
														Non-Aktif
													</span>
												{/if}
											</td>
											<td class="max-w-xs truncate px-4 py-3.5 text-slate-600"
												>{dept.alamat_departmen || dept.address}</td
											>
											<td class="px-4 py-3.5 text-right whitespace-nowrap">
												<div class="inline-flex items-center justify-end gap-2">
													<button
														onclick={() => openEditDeptModal(dept)}
														class="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:border-indigo-300 hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
														title="Edit Departemen"
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
															stroke-width="2"
															stroke="currentColor"
															class="h-3.5 w-3.5"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
															/>
														</svg>
														<span>Edit</span>
													</button>

													{#if dept.is_active !== false}
														<button
															onclick={() => handleToggleDeptStatus(dept)}
															class="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-2xs transition hover:border-amber-300 hover:bg-amber-100 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
															title="Nonaktifkan Departemen"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="2"
																stroke="currentColor"
																class="h-3.5 w-3.5"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
																/>
															</svg>
															<span>Nonaktifkan</span>
														</button>
													{:else}
														<button
															onclick={() => handleToggleDeptStatus(dept)}
															class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
															title="Aktifkan Departemen"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
																stroke-width="2"
																stroke="currentColor"
																class="h-3.5 w-3.5"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
																/>
															</svg>
															<span>Aktifkan</span>
														</button>
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>

							{#if filteredDepartments.length === 0}
								<div class="py-12 text-center">
									<p class="text-sm font-semibold text-slate-400">
										Tidak ada departemen ditemukan untuk filter ini.
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
							<div class="flex items-center justify-between pb-4">
								<div>
									<p class="font-bold text-slate-800">Backup Database Terjadwal</p>
									<p class="mt-1 text-sm text-slate-500">
										Lakukan backup otomatis setiap jam 02:00 AM
									</p>
								</div>
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
		onclick={(e) => {
			if (e.target === e.currentTarget) closeAddUserModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeAddUserModal();
		}}
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
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-6 w-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900">Tambah User Baru</h2>
					<p class="text-sm text-slate-500">
						Buat akun pengguna baru untuk pasien maupun staf rumah sakit.
					</p>
				</div>
			</div>

			<!-- Backend Error Banner -->
			{#if addUserBackendError}
				<div
					class="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm"
				>
					<div class="flex gap-3">
						<span class="text-lg">⚠️</span>
						<div>
							<strong class="block font-semibold">Terdapat Kesalahan Server / Backend:</strong>
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
						placeholder="Minimal 6 karakter"
					/>
					{#if addUserForm.password.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isAddPasswordValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Password Checklist Dropdown -->
				{#if isAddUserPasswordFocused}
					<div
						class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm transition-all duration-300"
					>
						<p class="mb-1.5 font-medium text-slate-700">Syarat kata sandi:</p>
						<ul class="space-y-1">
							<li
								class="flex items-center gap-1.5 {isAddPwdLength
									? 'text-green-600'
									: 'text-slate-500'}"
							>
								<span>{isAddPwdLength ? '✅' : '❌'}</span> Minimal 6 karakter
							</li>
							<li
								class="flex items-center gap-1.5 {isAddPwdUpper
									? 'text-green-600'
									: 'text-slate-500'}"
							>
								<span>{isAddPwdUpper ? '✅' : '❌'}</span> Minimal 1 huruf kapital
							</li>
							<li
								class="flex items-center gap-1.5 {isAddPwdLower
									? 'text-green-600'
									: 'text-slate-500'}"
							>
								<span>{isAddPwdLower ? '✅' : '❌'}</span> Minimal 1 huruf kecil
							</li>
							<li
								class="flex items-center gap-1.5 {isAddPwdNum
									? 'text-green-600'
									: 'text-slate-500'}"
							>
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
						onchange={handleRoleChange}
						class="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22currentColor%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%222%22 d=%22M19 9l-7 7-7-7%22 /></svg>'); background-repeat: no-repeat; background-position: right 0.75rem center; background-size: 1.25em 1.25em;"
					>
						{#each addUserRoleOptions as roleOpt (roleOpt.value)}
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
							<span class="absolute top-10 right-10 text-sm"
								>{isAddBirthDateValid() ? '✅' : '❌'}</span
							>
						{/if}
					</label>
				</div>

				<!-- Alamat / Departemen -->
				{#if addUserForm.role === 'PATIENT'}
				<!-- For patients: show address and optional family members only -->
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

				<!-- Optional family members: 1 akun bisa menampung data keluarga (card style) -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<p class="text-sm font-medium text-slate-700">Anggota keluarga (opsional)</p>
						<button
							type="button"
							onclick={() => addUserForm.familyMembers = [...addUserForm.familyMembers, { name: '', gender: '', age: undefined, alergi_obat: '' }]}
							class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
							</svg>
							Tambah Anggota
						</button>
					</div>
					<div class="grid gap-3">
						{#each addUserForm.familyMembers as fam, idx (idx)}
							<div class="relative rounded-2xl border p-3 shadow-sm">
								<!-- delete icon inside card -->
								<button
									type="button"
									onclick={() => (addUserForm.familyMembers = addUserForm.familyMembers.filter((_, i) => i !== idx))}
									class="mb-2 absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
									aria-label="Hapus anggota keluarga"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M6 2a1 1 0 00-.894.553L4 4H2a1 1 0 100 2h1v9a2 2 0 002 2h8a2 2 0 002-2V6h1a1 1 0 100-2h-2l-1.106-1.447A1 1 0 0014 2H6zm3 6a1 1 0 10-2 0v6a1 1 0 102 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
								</svg>
								</button>
									<div class="grid gap-2 sm:grid-cols-4">
											<div class="sm:col-span-2">
												<label class="text-xs text-slate-600">Nama Pasien</label>
												<input bind:value={fam.name} placeholder="Nama Pasien" class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
											</div>
											<div>
												<label class="text-xs text-slate-600">Gender</label>
												<select bind:value={fam.gender} class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
													<option value="">Pilih</option>
													<option value="male">Laki-laki</option>
													<option value="female">Perempuan</option>
												</select>
											</div>
											<div>
												<label class="text-xs text-slate-600">Umur</label>
												<input bind:value={fam.age} type="number" min="0" placeholder="Umur" class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
											</div>
											<div class="sm:col-span-4">
												<label class="text-xs text-slate-600">Alergi obat</label>
												<input bind:value={fam.alergi_obat} placeholder="Alergi obat (opsional)" class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 min-h-[44px]" />
											</div>
										</div>
								</div>
							{/each}
							</div>
							</div>
						{:else if addUserForm.role === 'SUPERADMIN' || addUserForm.role === 'OWNER'}
							<!-- For SUPERADMIN/OWNER: show only address (no family members, no dept) -->
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
							<!-- Interactive Department Selector -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-slate-700">
								{addressLabel}
								<span class="font-bold text-indigo-600">(Pilih Departemen Penugasan)</span>
							</span>
							{#if departments.length > 2}
								<input
									type="text"
									bind:value={deptSearchInUserModal}
									placeholder="Cari departemen..."
									class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none focus:border-indigo-500 focus:bg-white"
								/>
							{/if}
							<!-- debug button removed -->
						</div>

						<!-- Grid Card Departemen -->
						<div class="grid max-h-52 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
							{#each departmentStore.list.filter(d => (deptSearchInUserModal.trim() === '' ? true : ((d.kode_departmen || d.departmen_code || '').toLowerCase().includes(deptSearchInUserModal.trim().toLowerCase()) || (d.nama_departmen || d.name || '').toLowerCase().includes(deptSearchInUserModal.trim().toLowerCase()) || (d.alamat_departmen || d.address || '').toLowerCase().includes(deptSearchInUserModal.trim().toLowerCase()))) && deptMatchesRole(d, addUserForm.role)) as dept (dept.id || dept.id_departmen || dept.departmen_code)}
								{@const isSelected =
									addUserForm.departmenId === dept.id ||
									addUserForm.departmenId === dept.id_departmen}
								<button
									type="button"
										onclick={() => {
										addUserForm.departmenId = dept.id || dept.id_departmen || '';
										addUserForm.alamat = dept.alamat_departmen || dept.address || '';
									}}
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
											{dept.kode_departmen || dept.departmen_code}
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
										<p class="text-sm leading-snug font-bold text-slate-900">
											{dept.nama_departmen || dept.name}
										</p>
										<p
											class="mt-1 line-clamp-2 flex items-start gap-1 text-xs leading-relaxed text-slate-500"
										>
											<span class="shrink-0 text-slate-400">📍</span>
											<span>{dept.alamat_departmen || dept.address}</span>
										</p>
									</div>
								</button>
							{/each}
						</div>

						<!-- Selected Department Confirmation Banner -->
						{#if departmentStore.list.find(d => d.id === addUserForm.departmenId || d.id_departmen === addUserForm.departmenId)}
							{@const sd = departmentStore.list.find(d => d.id === addUserForm.departmenId || d.id_departmen === addUserForm.departmenId)}
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
										{sd.nama_departmen || sd.name} ({sd.kode_departmen || sd.departmen_code})
									</p>
									<p class="mt-0.5 text-slate-600">
										{sd.alamat_departmen || sd.address}
									</p>
								</div>
							</div>
						{:else}
							<div
								class="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800"
							>
								<span class="text-base">⚠️</span>
								<span class="font-medium"
									>Silakan klik salah satu kartu departemen di atas untuk memilih departemen tempat
									kerja staf.</span
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
						<li
							class="flex items-center gap-2 {isAddNameValid ? 'text-green-600' : 'text-slate-500'}"
						>
							<span>{isAddNameValid ? '✅' : '❌'}</span> Nama (3-100 karakter)
						</li>
						<li
							class="flex items-center gap-2 {isAddEmailValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddEmailValid ? '✅' : '❌'}</span> Format email valid
						</li>
						<li
							class="flex items-center gap-2 {isAddPasswordValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddPasswordValid ? '✅' : '❌'}</span> Kata sandi memenuhi syarat (min 6 char)
						</li>
						<li
							class="flex items-center gap-2 {isAddConfirmValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddConfirmValid ? '✅' : '❌'}</span> Konfirmasi sandi cocok
						</li>
						<li
							class="flex items-center gap-2 {isAddRoleValid ? 'text-green-600' : 'text-slate-500'}"
						>
							<span>{isAddRoleValid ? '✅' : '❌'}</span> Role dipilih
						</li>
						<li
							class="flex items-center gap-2 {isAddPhoneValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddPhoneValid ? '✅' : '❌'}</span> No. HP format Indonesia
						</li>
						<li
							class="flex items-center gap-2 {isAddBirthDateValid()
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddBirthDateValid() ? '✅' : '❌'}</span> Tanggal lahir valid (1-120 tahun)
						</li>
						<li
							class="flex items-center gap-2 {isAddAddressValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isAddAddressValid ? '✅' : '❌'}</span>
							{addUserForm.role === 'PATIENT'
									? 'Alamat tempat tinggal (min. 10 karakter)'
									: 'Departemen tempat kerja dipilih'}
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
<!-- MODAL: DETAIL & EDIT USER (GET & PATCH /users/:id) -->
<!-- ========================================= -->
{#if showUserDetailModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeUserDetailModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeUserDetailModal();
		}}
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Detail & Edit akun user"
	>
		<div
			class="relative my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
		>
			<!-- Close Button -->
			<button
				onclick={closeUserDetailModal}
				class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
				aria-label="Tutup modal"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div
					class="rounded-2xl {isEditUserMode
						? 'bg-indigo-100 text-indigo-700'
						: 'bg-sky-100 text-sky-700'} p-3"
				>
					{#if isEditUserMode}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-6 w-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
							/>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="h-6 w-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
							/>
						</svg>
					{/if}
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900">
						{isEditUserMode ? 'Edit Informasi User' : 'Detail Spesifik Akun User'}
					</h2>
					<p class="text-sm text-slate-500">
						{isEditUserMode
							? 'Perbarui data profil & informasi akun pengguna'
							: 'Informasi detail dan profil akun pengguna'}
					</p>
				</div>
			</div>

			{#if isFetchingUserDetail}
				<div class="py-12 text-center">
					<div
						class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
					></div>
					<p class="mt-3 text-sm font-semibold text-slate-500">Memuat detail data pengguna...</p>
				</div>
			{:else if selectedUserDetail}
				{#if isEditUserMode}
					<!-- ========================================= -->
					<!-- EDIT FORM MODE -->
					<!-- ========================================= -->
					<form class="space-y-4" onsubmit={handleSaveUserEdit}>
						{#if editUserBackendError}
							<div
								class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700"
							>
								⚠️ {editUserBackendError}
							</div>
						{/if}

						<!-- Role Info Tag -->
						<div
							class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3"
						>
							<span class="text-xs font-semibold text-slate-500">Role Akun</span>
							<span
								class="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${getRoleBadgeClass(
									selectedUserDetail.role
								)}"
							>
								{getRoleLabel(selectedUserDetail.role)}
							</span>
						</div>

						<!-- Nama Lengkap -->
						<label class="relative block text-sm font-medium text-slate-700">
							<span class="mb-1 block">Nama Lengkap</span>
							<input
								bind:value={editUserForm.name}
								type="text"
								required
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								placeholder="Nama lengkap user"
							/>
							{#if editUserForm.name.length > 0}
								<span class="absolute top-9 right-3 text-sm">{isEditNameValid ? '✅' : '❌'}</span>
							{/if}
						</label>

						<!-- Email -->
						<label class="relative block text-sm font-medium text-slate-700">
							<span class="mb-1 block">Alamat Email</span>
							<input
								bind:value={editUserForm.email}
								type="email"
								required
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								placeholder="email@domain.com"
							/>
							{#if editUserForm.email.length > 0}
								<span class="absolute top-9 right-3 text-sm">{isEditEmailValid ? '✅' : '❌'}</span>
							{/if}
						</label>

						<!-- Password Baru (Opsional) -->
						<label class="relative block text-sm font-medium text-slate-700">
							<span class="mb-1 block">Password Baru (Opsional)</span>
							<input
								bind:value={editUserForm.password}
								type="password"
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								placeholder="Kosongkan jika tidak ingin mengubah password"
							/>
							{#if editUserForm.password.length > 0}
								<span class="absolute top-9 right-3 text-sm"
									>{isEditPasswordValid ? '✅' : '❌'}</span
								>
							{/if}
							<span class="mt-1 block text-[11px] text-slate-400"
								>Isi minimal 6 karakter hanya jika ingin mengganti password user.</span
							>
						</label>

						<!-- No HP & Tanggal Lahir -->
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="relative block text-sm font-medium text-slate-700">
								<span class="mb-1 block">Nomor Telepon</span>
								<input
									bind:value={editUserForm.phone}
									type="tel"
									class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									placeholder="081234567890"
								/>
								{#if editUserForm.phone.length > 0}
									<span class="absolute top-9 right-3 text-sm"
										>{isEditPhoneValid ? '✅' : '❌'}</span
									>
								{/if}
							</label>

							<label class="relative block text-sm font-medium text-slate-700">
								<span class="mb-1 block">Tanggal Lahir</span>
								<input
									bind:value={editUserForm.birthDate}
									type="date"
									class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								/>
								{#if editUserForm.birthDate.length > 0}
									<span class="absolute top-9 right-10 text-sm"
										>{isEditBirthDateValid() ? '✅' : '❌'}</span
									>
								{/if}
							</label>
						</div>

						<!-- Status Akun (Aktif / Nonaktif) -->
						<label class="block text-sm font-medium text-slate-700">
							<span class="mb-1 block">Status Akun</span>
							<select
								bind:value={editUserForm.is_active}
								class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
							>
								<option value={true}>✅ Aktif</option>
								<option value={false}>❌ Non-Aktif (Di-deaktivasi)</option>
							</select>
						</label>

						<!-- Alamat Tempat Tinggal / Departemen Penugasan -->
						{#if selectedUserDetail.role === 'pasien'}
							<label class="relative block text-sm font-medium text-slate-700">
								<span class="mb-1 block">Alamat Tempat Tinggal (Pasien)</span>
								<textarea
									bind:value={editUserForm.address}
									rows="3"
									class="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									placeholder="Alamat lengkap tempat tinggal pasien..."></textarea>
								{#if editUserForm.address.length > 0}
									<span class="absolute top-9 right-3 text-sm"
										>{isEditAddressValid ? '✅' : '❌'}</span
									>
								{/if}
							</label>
						{:else}
							<!-- Interactive Department Selector (Identik dengan Create User) -->
							<div class="space-y-3">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-slate-700">
										Alamat / Departemen <span class="font-bold text-indigo-600"
											>(Pilih Departemen Penugasan)</span
										>
									</span>
									{#if departments.length > 2}
										<input
											type="text"
											bind:value={editDeptSearch}
											placeholder="Cari departemen..."
											class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none focus:border-indigo-500 focus:bg-white"
										/>
									{/if}
								</div>

								<!-- Grid Card Departemen -->
								<div class="grid max-h-52 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
									{#each departmentStore.list.filter(d => (editDeptSearch.trim() === '' ? true : ((d.kode_departmen || d.departmen_code || '').toLowerCase().includes(editDeptSearch.trim().toLowerCase()) || (d.nama_departmen || d.name || '').toLowerCase().includes(editDeptSearch.trim().toLowerCase()) || (d.city || '').toLowerCase().includes(editDeptSearch.trim().toLowerCase()) || (d.alamat_departmen || d.address || '').toLowerCase().includes(editDeptSearch.trim().toLowerCase())))) as dept (dept.id || dept.id_departmen || dept.departmen_code)}
										{@const isSelected =
											editUserForm.departmenId === dept.id ||
											editUserForm.departmenId === dept.id_departmen}
										<button
											type="button"
											onclick={() => {
												editUserForm.departmenId = dept.id || dept.id_departmen || '';
												editUserForm.address = dept.alamat_departmen || dept.address || '';
											}}
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
													{dept.kode_departmen || dept.departmen_code}
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
												<p class="text-sm leading-snug font-bold text-slate-900">
													{dept.nama_departmen || dept.name}
												</p>
												{#if dept.city}
													<p class="text-[11px] font-semibold text-indigo-600">
														Cabang {dept.city}
													</p>
												{/if}
												<p
													class="mt-1 line-clamp-2 flex items-start gap-1 text-xs leading-relaxed text-slate-500"
												>
													<span class="shrink-0 text-slate-400">📍</span>
													<span>{dept.alamat_departmen || dept.address}</span>
												</p>
											</div>
										</button>
									{/each}
								</div>

								<!-- Selected Department Confirmation Banner -->
								{#if selectedEditDept}
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
												>
													{selectedEditDept.kode_departmen || selectedEditDept.departmen_code}
												</span>
											</div>
											<p class="mt-0.5 font-semibold text-indigo-900">
												{selectedEditDept.nama_departmen || selectedEditDept.name}
												{#if selectedEditDept.city}
													- Cabang {selectedEditDept.city}
												{/if}
											</p>
											<p class="mt-0.5 text-slate-600">
												{selectedEditDept.alamat_departmen || selectedEditDept.address}
											</p>
										</div>
									</div>
								{:else}
									<div
										class="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800"
									>
										<span class="text-base">⚠️</span>
										<span class="font-medium"
											>Silakan klik salah satu kartu departemen di atas untuk memilih departemen
											tempat kerja staf.</span
										>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Validation Checklist Box -->
						<div
							class="rounded-2xl border {isEditFormValid
								? 'border-green-300 bg-green-50/50'
								: 'border-slate-200 bg-white/60'} p-4 text-sm transition-all"
						>
							<p class="mb-2 font-medium text-slate-700">Status Validasi Formulir Edit</p>
							<ul class="grid gap-1.5 text-xs sm:grid-cols-2">
								<li
									class="flex items-center gap-2 {isEditNameValid
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditNameValid ? '✅' : '❌'}</span> Nama (3-100 karakter)
								</li>
								<li
									class="flex items-center gap-2 {isEditEmailValid
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditEmailValid ? '✅' : '❌'}</span> Format email valid
								</li>
								<li
									class="flex items-center gap-2 {isEditPasswordValid
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditPasswordValid ? '✅' : '❌'}</span> Password (kosong / min 6 char)
								</li>
								<li
									class="flex items-center gap-2 {isEditPhoneValid
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditPhoneValid ? '✅' : '❌'}</span> No. HP (opsional / format Indonesia)
								</li>
								<li
									class="flex items-center gap-2 {isEditBirthDateValid()
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditBirthDateValid() ? '✅' : '❌'}</span> Tanggal lahir valid (1-120 thn)
								</li>
								<li
									class="flex items-center gap-2 {isEditAddressValid
										? 'text-green-600'
										: 'text-slate-500'}"
								>
									<span>{isEditAddressValid ? '✅' : '❌'}</span>
									{selectedUserDetail.role === 'pasien'
										? 'Alamat tempat tinggal'
										: 'Departemen penugasan dipilih'}
								</li>
							</ul>
						</div>

						<!-- Action Buttons Edit -->
						<div class="flex gap-3 border-t border-slate-100 pt-4">
							<button
								type="button"
								onclick={cancelEditingUser}
								class="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
							>
								Batal
							</button>
							<button
								type="submit"
								disabled={!isEditFormValid || isEditUserSubmitting}
								class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isEditUserSubmitting ? 'Memproses...' : 'Simpan Perubahan'}
							</button>
						</div>
					</form>
				{:else}
					<!-- ========================================= -->
					<!-- DETAIL VIEW MODE -->
					<!-- ========================================= -->
					<div class="space-y-4">
						<!-- ID Primary & Display Badge -->
						<div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold text-slate-500">User Primary ID (DB)</span>
								<span
									class="rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${getRoleBadgeClass(
										selectedUserDetail.role
									)}"
								>
									{getRoleLabel(selectedUserDetail.role)}
								</span>
							</div>
							<p class="mt-1 font-mono text-sm font-bold text-indigo-600 select-all">
								{selectedUserDetail.id}
							</p>

							{#if selectedUserDetail.patientUser?.medical_record_number}
								<div
									class="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2"
								>
									<span class="text-xs font-medium text-slate-500">No. Rekam Medis (MRN)</span>
									<span class="font-mono text-xs font-bold text-slate-800"
										>{selectedUserDetail.patientUser.medical_record_number}</span
									>
								</div>
							{/if}

							{#if selectedUserDetail.employeeUser?.staff_code}
								<div
									class="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2"
								>
									<span class="text-xs font-medium text-slate-500">Kode Staff / Pegawai</span>
									<span class="font-mono text-xs font-bold text-slate-800"
										>{selectedUserDetail.employeeUser.staff_code}</span
									>
								</div>
							{/if}
						</div>

						<!-- Details Grid -->
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="rounded-xl border border-slate-200/70 p-3">
								<span class="text-xs font-medium text-slate-500">Nama Lengkap</span>
								<p class="font-bold text-slate-900">{selectedUserDetail.name}</p>
							</div>
							<div class="rounded-xl border border-slate-200/70 p-3">
								<span class="text-xs font-medium text-slate-500">Email</span>
								<p class="truncate font-bold text-slate-900">{selectedUserDetail.email}</p>
							</div>
							<div class="rounded-xl border border-slate-200/70 p-3">
								<span class="text-xs font-medium text-slate-500">Nomor Telepon</span>
								<p class="font-bold text-slate-900">{selectedUserDetail.phone || '-'}</p>
							</div>
							<div class="rounded-xl border border-slate-200/70 p-3">
								<span class="text-xs font-medium text-slate-500">Tanggal Lahir</span>
								<p class="font-bold text-slate-900">
									{selectedUserDetail.birth_date
										? new Date(selectedUserDetail.birth_date).toLocaleDateString('id-ID', {
												year: 'numeric',
												month: 'long',
												day: 'numeric'
											})
										: '-'}
								</p>
							</div>
							<div class="rounded-xl border border-slate-200/70 p-3 sm:col-span-2">
								<span class="text-xs font-medium text-slate-500">Status Akun</span>
								<p
									class={`font-bold ${selectedUserDetail.is_active ? 'text-emerald-600' : 'text-rose-600'}`}
								>
									{selectedUserDetail.is_active ? '✅ Aktif' : '❌ Non-Aktif'}
								</p>
							</div>
						</div>

						{#if selectedUserDetail.employeeUser?.departmen}
							<div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
								<span class="text-xs font-medium text-indigo-700">Departemen Penugasan</span>
								<p class="font-bold text-indigo-950">
									{selectedUserDetail.employeeUser.departmen.name} ({selectedUserDetail.employeeUser
										.departmen.departmen_code})
								</p>
								<p class="mt-0.5 text-xs text-slate-600">
									{selectedUserDetail.employeeUser.departmen.address}
								</p>
							</div>
						{/if}

						<div class="rounded-xl border border-slate-200/70 p-3">
							<span class="text-xs font-medium text-slate-500">Alamat Tempat Tinggal</span>
							<p class="text-sm font-semibold text-slate-800">
								{selectedUserDetail.address || '-'}
							</p>
						</div>

						<!-- Action Controls Detail View -->
						<div class="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
							<button
								type="button"
								onclick={startEditingUser}
								class="min-w-[120px] flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700"
							>
								✏️ Edit Data
							</button>

							<button
								type="button"
								onclick={async () => {
									if (selectedUserDetail) {
										await handleToggleUserStatus(selectedUserDetail);
										closeUserDetailModal();
									}
								}}
								class={`min-w-[120px] flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-md transition ${selectedUserDetail.is_active ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
							>
								{selectedUserDetail.is_active ? '⏸️ Nonaktifkan' : '▶️ Aktifkan'}
							</button>

							<button
								type="button"
								onclick={closeUserDetailModal}
								class="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
							>
								Tutup
							</button>
						</div>
					</div>
				{/if}
			{:else}
				<div class="py-6 text-center text-slate-500">Data detail user tidak dapat dimuat.</div>
			{/if}
		</div>
	</div>
{/if}

<!-- ========================================= -->
<!-- MODAL: TAMBAH / EDIT DEPARTEMEN           -->
<!-- ========================================= -->
{#if showDeptModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeDeptModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeDeptModal();
		}}
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
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="h-4 w-4"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-6 w-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.75m-.75 3h.75m-.75 3h.75"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-slate-900">
						{isEditDept ? 'Edit Departemen' : 'Tambah Departemen Baru'}
					</h2>
					<p class="text-sm text-slate-500">
						{isEditDept
							? 'Perbarui informasi departemen'
							: 'Daftarkan departemen atau unit pelayanan baru'}
					</p>
				</div>
			</div>

			<!-- Form -->
			<form class="space-y-4" onsubmit={handleSaveDept}>
				{#if deptModalError}
					<div
						class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700"
					>
						⚠️ {deptModalError}
					</div>
				{/if}

				<!-- Kode Departemen -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Kode Departemen</span>
					<input
						bind:value={deptForm.code}
						type="text"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

				<!-- Kota / Cabang -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Kota / Cabang</span>
					<input
						bind:value={deptForm.city}
						type="text"
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Jakarta, Surabaya, Bandung..."
					/>
				</label>

				<!-- Alamat Departemen -->
				<label class="relative block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Alamat Departemen</span>
					<textarea
						bind:value={deptForm.address}
						rows="3"
						class="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
						placeholder="Gedung Utama Lantai 1, RS Medika Sehat Jakarta"></textarea>
					{#if deptForm.address.length > 0}
						<span class="absolute top-10 right-3 text-sm">{isDeptAddressValid ? '✅' : '❌'}</span>
					{/if}
				</label>

				<!-- Status Departemen -->
				<label class="block text-sm font-medium text-slate-700">
					<span class="mb-2 block">Status Departemen</span>
					<select
						bind:value={deptForm.is_active}
						class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm transition outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
					>
						<option value={true}>Aktif</option>
						<option value={false}>Non-Aktif</option>
					</select>
				</label>

				<!-- Validation Checklist -->
				<div
					class="rounded-2xl border {isDeptFormValid
						? 'border-green-300 bg-green-50/50'
						: 'border-slate-200 bg-white/60'} p-4 text-sm transition-all"
				>
					<p class="mb-2 font-medium text-slate-700">Status Validasi Formulir</p>
					<ul class="space-y-1.5 text-xs">
						<li
							class="flex items-center gap-2 {isDeptCodeValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isDeptCodeValid ? '✅' : '❌'}</span> Kode Departemen valid (3-20 karakter, alfanumerik
							& tanda hubung)
						</li>
						<li
							class="flex items-center gap-2 {isDeptNameValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isDeptNameValid ? '✅' : '❌'}</span> Nama Departemen terisi dengan benar (3-100
							karakter)
						</li>
						<li
							class="flex items-center gap-2 {isDeptAddressValid
								? 'text-green-600'
								: 'text-slate-500'}"
						>
							<span>{isDeptAddressValid ? '✅' : '❌'}</span> Alamat Departemen terisi dengan benar (min.
							10 karakter)
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
<!-- MODAL: TAMBAH / EDIT RUMAH SAKIT         -->
<!-- ========================================= -->
{#if showHospitalModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeHospitalModal();
		}}
	>
		<div
			class="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all"
		>
			<!-- Header Modal -->
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-slate-900">
							{isEditHospital ? 'Edit Rumah Sakit / Klinik' : 'Tambah Rumah Sakit / Klinik'}
						</h3>
						<p class="text-xs text-slate-500">
							{isEditHospital ? 'Perbarui data identitas dan akses rumah sakit' : 'Daftarkan rumah sakit atau klinik cabang baru'}
						</p>
					</div>
				</div>
				<button
					onclick={closeHospitalModal}
					class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					✕
				</button>
			</div>

			<!-- Error Alert -->
			{#if hospitalModalError}
				<div class="m-6 mb-0 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
					⚠️ {hospitalModalError}
				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={handleSaveHospital} class="p-6 space-y-4">
				<!-- Kode RS -->
				<div>
					<label class="mb-1 block text-xs font-bold text-slate-700">Kode Rumah Sakit / Klinik <span class="text-rose-500">*</span></label>
					<input
						type="text"
						bind:value={hospitalForm.code}
						placeholder="Misal: RS-MDK01"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase font-mono font-bold outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
					/>
					<p class="mt-1 text-[11px] text-slate-400">Minimal 2-50 karakter (Huruf, Angka, Strip, Underscore)</p>
				</div>

				<!-- Nama RS -->
				<div>
					<label class="mb-1 block text-xs font-bold text-slate-700">Nama Rumah Sakit / Klinik <span class="text-rose-500">*</span></label>
					<input
						type="text"
						bind:value={hospitalForm.name}
						placeholder="Misal: Rumah Sakit Medika Utama"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
					/>
					<p class="mt-1 text-[11px] text-slate-400">Minimal 2-150 karakter</p>
				</div>

				<!-- Alamat RS -->
				<div>
					<label class="mb-1 block text-xs font-bold text-slate-700">Alamat Lengkap <span class="text-rose-500">*</span></label>
					<textarea
						bind:value={hospitalForm.address}
						rows="3"
						placeholder="Jl. Pemuda No. 45, Jakarta Pusat"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
					></textarea>
					<p class="mt-1 text-[11px] text-slate-400">Minimal 3-500 karakter</p>
				</div>

				<!-- Switch Status (Edit mode only) -->
				{#if isEditHospital}
					<div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
						<div>
							<p class="text-sm font-bold text-slate-800">Status Operasional</p>
							<p class="text-xs text-slate-500">Mengontrol aksesibilitas rumah sakit di sistem</p>
						</div>
						<label class="relative inline-flex cursor-pointer items-center">
							<input type="checkbox" bind:checked={hospitalForm.is_active} class="peer sr-only" />
							<div class="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
						</label>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex items-center gap-3 pt-4 border-t border-slate-100">
					<button
						type="button"
						onclick={closeHospitalModal}
						class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={!isHospitalFormValid || isHospitalSubmitting}
						class="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isHospitalSubmitting ? 'Menyimpan...' : isEditHospital ? 'Simpan Perubahan' : 'Tambah Rumah Sakit'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ========================================= -->
<!-- MODAL: DETAIL RUMAH SAKIT                -->
<!-- ========================================= -->
{#if showHospitalDetailModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeHospitalDetailModal();
		}}
	>
		<div class="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-slate-900">Detail Rumah Sakit / Klinik</h3>
						<p class="text-xs text-slate-500">Informasi lengkap instansi dan departemen terdaftar</p>
					</div>
				</div>
				<button
					onclick={closeHospitalDetailModal}
					class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					✕
				</button>
			</div>

			<div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
				{#if isFetchingHospitalDetail}
					<div class="py-12 text-center text-slate-400">
						<div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
						<p class="mt-2 text-xs font-semibold">Memuat detail rumah sakit...</p>
					</div>
				{:else if selectedHospitalDetail}
					<!-- Info Utama Card -->
					<div class="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-3">
						<div class="flex items-center justify-between">
							<span class="rounded-lg bg-indigo-100 px-3 py-1 font-mono text-xs font-bold text-indigo-700">
								{selectedHospitalDetail.hospital_code || selectedHospitalDetail.kode_hospital}
							</span>
							{#if selectedHospitalDetail.is_active !== false}
								<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
									<span class="h-2 w-2 rounded-full bg-emerald-500"></span> Aktif
								</span>
							{:else}
								<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
									<span class="h-2 w-2 rounded-full bg-slate-500"></span> Non-Aktif
								</span>
							{/if}
						</div>
						<h2 class="text-xl font-black text-slate-900">{selectedHospitalDetail.name || selectedHospitalDetail.nama_hospital}</h2>
						<p class="text-xs text-slate-600">📍 {selectedHospitalDetail.address || selectedHospitalDetail.alamat_hospital || '-'}</p>
					</div>

					<!-- Grid Attributes -->
					<div class="grid grid-cols-2 gap-4">
						<div class="rounded-xl border border-slate-100 p-4">
							<p class="text-xs font-semibold text-slate-400">Pemilik / Owner</p>
							<p class="mt-1 text-sm font-bold text-slate-800">{selectedHospitalDetail.owner?.name || 'Superadmin'}</p>
							<p class="text-[11px] text-slate-500">{selectedHospitalDetail.owner?.email || '-'}</p>
						</div>
						<div class="rounded-xl border border-slate-100 p-4">
							<p class="text-xs font-semibold text-slate-400">Total Departemen</p>
							<p class="mt-1 text-sm font-bold text-slate-800">{selectedHospitalDetail.department_count ?? 0} Unit</p>
							<p class="text-[11px] text-slate-500">Terhubung secara struktural</p>
						</div>
					</div>

					<!-- Departemen List -->
					<div>
						<h4 class="mb-3 text-sm font-bold text-slate-800">Daftar Departemen Terhubung ({selectedHospitalDetail.departments?.length ?? 0})</h4>
						{#if selectedHospitalDetail.departments && selectedHospitalDetail.departments.length > 0}
							<div class="divide-y divide-slate-100 rounded-xl border border-slate-100">
								{#each selectedHospitalDetail.departments as dept ((dept as any).id)}
									<div class="flex items-center justify-between p-3">
										<div>
											<p class="text-xs font-bold text-slate-900">{dept.name}</p>
											<p class="font-mono text-[11px] text-indigo-600">{dept.departmen_code}</p>
										</div>
										<span class="text-[10px] font-bold px-2 py-0.5 rounded-md {dept.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
											{dept.is_active ? 'Aktif' : 'Non-Aktif'}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-400">
								Belum ada departemen yang didaftarkan pada rumah sakit ini.
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-right">
				<button
					onclick={closeHospitalDetailModal}
					class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ========================================= -->
<!-- MODAL: ALERT KONFIRMASI SOFT DELETE RS   -->
<!-- ========================================= -->
{#if showHospitalDeleteModal && deletingHospital}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeDeleteHospitalModal();
		}}
	>
		<div class="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-150">
			<div class="p-6 text-center space-y-4">
				<!-- Warning Icon Badge -->
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>

				<div>
					<h3 class="text-lg font-black text-slate-900">Konfirmasi Soft Delete Rumah Sakit</h3>
					<p class="mt-1 text-sm font-semibold text-rose-600">
						"{deletingHospital.name || deletingHospital.nama_hospital}"
					</p>
				</div>

				<!-- Cascading Warning Card -->
				<div class="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-left space-y-2 text-xs text-rose-800">
					<p class="font-bold flex items-center gap-1.5 text-rose-900">
						<span>🚨</span> PERINGATAN DAMPAK CASCADING:
					</p>
					<ul class="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
						<li>Rumah Sakit ini akan dinonaktifkan (Soft Delete).</li>
						<li><strong>Seluruh Departemen</strong> di bawah rumah sakit ini akan ikut **nonaktif**.</li>
						<li><strong>Seluruh Akun User / Staf</strong> yang terdaftar di departemen-departemen tersebut akan ikut **nonaktif**.</li>
					</ul>
				</div>

				{#if hospitalDeleteError}
					<div class="rounded-xl border border-rose-300 bg-rose-100 p-3 text-xs font-semibold text-rose-800">
						⚠️ {hospitalDeleteError}
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex items-center gap-3 pt-2">
					<button
						type="button"
						onclick={closeDeleteHospitalModal}
						class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
					>
						Batal
					</button>
					<button
						type="button"
						disabled={isHospitalDeleting}
						onclick={confirmDeleteHospital}
						class="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
					>
						{isHospitalDeleting ? 'Menonaktifkan...' : 'Ya, Nonaktifkan RS'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
