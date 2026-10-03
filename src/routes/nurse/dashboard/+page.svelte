<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Title from '$lib/components/Title.svelte';
	import NursingAssessmentModal from '$lib/components/NursingAssessmentModal.svelte';
	import NursePatientHistoryDetailModal from '$lib/components/NursePatientHistoryDetailModal.svelte';
	import { validateSession } from '$lib/utils/getProfile';
	import {
		createNursePatientHistoryStore,
		type VisitStatus
	} from '$lib/stores/nursePatientHistory.svelte';

	type Patient = {
		visitId: string;
		registrationTime: string;
		status: VisitStatus;
		payerType: string;
		queueNumber: string;
		medicalRecordNumber: string;
		patientName: string;
		gender: string;
		age: number | null;
		slot: {
			name: string;
			startHour: string;
			endHour: string;
		};
	};

	const visitStatuses: VisitStatus[] = [
		'REGISTERED',
		'NURSE_CHECKED',
		'DOCTOR_EXAMINED',
		'CANCELLED',
		'COMPLETED'
	];

	const statusLabels: Record<VisitStatus, string> = {
		REGISTERED: 'Menunggu asesmen',
		NURSE_CHECKED: 'Sudah diperiksa perawat',
		DOCTOR_EXAMINED: 'Sudah diperiksa dokter',
		CANCELLED: 'Dibatalkan',
		COMPLETED: 'Selesai'
	};

	const historyStore = createNursePatientHistoryStore();

	let isLoading = $state(true);
	let isQueueLoading = $state(false);
	let isForbidden = $state(false);
	let loadError = $state('');
	let actionError = $state('');
	let actionMessage = $state('');
	let cancellingVisitId = $state<string | null>(null);
	let currentUser = $state<{ name: string; id: string; user_code?: string }>({
		name: '',
		id: ''
	});
	// Unit / poli aktif didapat OTOMATIS dari sesi (cookie) — tidak ada dropdown manual.
	let activeUnit = $state('Poli Umum');
	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);
	let patients = $state<Patient[]>([]);
	let assessmentPatient = $state<Patient | null>(null);
	let todayLabel = $state('');
	let historySearch = $state('');
	let selectedHistoryPatientId = $state('');
	let historyMedicalRecordFilter = $state('');
	let selectedHistoryVisitId = $state<string | null>(null);

	const isHistoryMenu = $derived(activeMenu === 'riwayat');
	const isBmhpMenu = $derived(activeMenu === 'bmhp');
	const currentLoading = $derived(isHistoryMenu ? historyStore.loading : isQueueLoading);
	const selectedHistoryVisit = $derived(
		historyStore.visits.find((visit) => visit.visitId === selectedHistoryVisitId) ?? null
	);

	const pageHeading = $derived(
		isHistoryMenu ? 'Riwayat Pasien' : isBmhpMenu ? 'Stok & Pemakaian BMHP' : 'Antrean Poli'
	);

	const pageSubtitle = $derived(
		isBmhpMenu
			? `Manajemen bahan habis pakai & alat kesehatan untuk unit ${activeUnit}`
			: `${todayLabel} · Selamat bertugas, ${currentUser.name || 'Perawat'}`
	);

	const historyPatients = $derived.by(() => {
		const uniquePatients = new Map<
			string,
			{ id: string; name: string; medicalRecordNumber: string }
		>();

		for (const visit of historyStore.visits) {
			if (!uniquePatients.has(visit.patient.id)) {
				uniquePatients.set(visit.patient.id, {
					id: visit.patient.id,
					name: visit.patient.name,
					medicalRecordNumber: visit.patient.medicalRecordNumber
				});
			}
		}

		return [...uniquePatients.values()].sort((a, b) =>
			a.name.localeCompare(b.name, 'id')
		);
	});

	const filteredHistory = $derived.by(() => {
		const query = historySearch.trim().toLocaleLowerCase('id-ID');

		return historyStore.visits.filter((visit) => {
			if (
				selectedHistoryPatientId &&
				visit.patient.id !== selectedHistoryPatientId
			) {
				return false;
			}

			if (
				historyMedicalRecordFilter &&
				visit.patient.medicalRecordNumber.trim() !== historyMedicalRecordFilter
			) {
				return false;
			}

			if (!query) return true;

			return [
				visit.patient.name,
				visit.patient.medicalRecordNumber,
				visit.complaint || '',
				visit.status,
				statusLabels[visit.status]
			].some((value) => value.toLocaleLowerCase('id-ID').includes(query));
		});
	});

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function text(value: unknown, fallback = '-'): string {
		if (typeof value === 'string' && value.trim()) return value.trim();
		if (typeof value === 'number' && Number.isFinite(value)) return String(value);
		return fallback;
	}

	function genderLabel(value: unknown): string {
		const gender = text(value);
		switch (gender.toUpperCase()) {
			case 'LAKILAKI':
			case 'LAKI-LAKI':
			case 'L':
				return 'Laki-laki';
			case 'PEREMPUAN':
			case 'P':
				return 'Perempuan';
			default:
				return gender;
		}
	}

	/**
	 * Ambil nama unit/poli asal perawat dari profil sesi (cookie-based).
	 * Tidak ada pemilih manual di UI — nilainya murni berasal dari sesi.
	 */
	function sessionUnit(profile: unknown): string {
		if (!isRecord(profile)) return 'Poli Umum';

		const candidates = [
			'unit_name',
			'unit',
			'poli',
			'department',
			'department_name',
			'ward',
			'room'
		];

		for (const key of candidates) {
			const value = profile[key];
			if (typeof value === 'string' && value.trim()) return value.trim();
		}

		return 'Poli Umum';
	}

	function normalizePatient(value: unknown): Patient {
		if (!isRecord(value) || !isRecord(value.patient) || !isRecord(value.slot)) {
			throw new Error('Format data pasien atau jadwal praktik tidak sesuai respons antrean.');
		}

		if (typeof value.visitId !== 'string' || !value.visitId.trim()) {
			throw new Error('Data antrean tidak memiliki visitId yang valid.');
		}

		if (
			typeof value.status !== 'string' ||
			!visitStatuses.includes(value.status as VisitStatus)
		) {
			throw new Error('Data antrean memiliki status kunjungan yang tidak dikenali.');
		}

		const patient = value.patient;
		const age =
			typeof patient.age === 'number' && Number.isFinite(patient.age)
				? patient.age
				: null;

		return {
			visitId: value.visitId,
			registrationTime: text(value.registrationTime),
			status: value.status as VisitStatus,
			payerType: text(value.payerType),
			queueNumber: text(value.queueNumber),
			medicalRecordNumber: text(patient.medicalRecordNumber),
			patientName: text(patient.name, 'Nama tidak tersedia'),
			gender: genderLabel(patient.gender),
			age,
			slot: {
				name: text(value.slot.name),
				startHour: text(value.slot.startHour),
				endHour: text(value.slot.endHour)
			}
		};
	}

	async function fetchQueue(): Promise<boolean> {
		if (isQueueLoading) return false;
		isQueueLoading = true;
		loadError = '';

		try {
			const response = await api.get<unknown>('/nurse/dashboard/visits/queue');

			if (!isRecord(response) || !Array.isArray(response.data)) {
				throw new Error('Format respons antrean tidak sesuai: data harus berupa array.');
			}

			const nextPatients = response.data.map(normalizePatient);
			const visitIds = new Set(nextPatients.map((patient) => patient.visitId));
			if (visitIds.size !== nextPatients.length) {
				throw new Error('Respons antrean memiliki visitId duplikat.');
			}

			patients = nextPatients;
			return true;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Gagal memuat antrean poli.';
			return false;
		} finally {
			isQueueLoading = false;
		}
	}

	function updateLocalStatus(visitId: string, status: VisitStatus) {
		patients = patients.map((patient) =>
			patient.visitId === visitId ? { ...patient, status } : patient
		);
	}

	async function handleAssessmentSaved() {
		if (!assessmentPatient) return;

		// Assessment creation updates this status in the backend.
		// Preserve the saved status locally even if refreshing the queue fails.
		updateLocalStatus(assessmentPatient.visitId, 'NURSE_CHECKED');
		actionMessage = 'Asesmen berhasil disimpan. Status kunjungan: NURSE_CHECKED.';

		if (!(await fetchQueue())) {
			throw new Error('Asesmen tersimpan, tetapi antrean gagal diperbarui.');
		}
	}

	function canCancel(status: VisitStatus): boolean {
		return status === 'REGISTERED' || status === 'NURSE_CHECKED';
	}

	async function cancelVisit(patient: Patient) {
		if (isQueueLoading || cancellingVisitId || !canCancel(patient.status)) return;

		const confirmed = window.confirm(
			`Batalkan kunjungan ${patient.patientName} dengan nomor antrean ${patient.queueNumber}?`
		);
		if (!confirmed) return;

		cancellingVisitId = patient.visitId;
		actionError = '';
		actionMessage = '';

		try {
			await api.patch(
				`/nurse/dashboard/visits/${encodeURIComponent(patient.visitId)}/status`,
				{ status: 'CANCELLED' }
			);

			updateLocalStatus(patient.visitId, 'CANCELLED');
			actionMessage = 'Kunjungan berhasil dibatalkan.';

			if (!(await fetchQueue())) {
				actionMessage =
					'Kunjungan berhasil dibatalkan, tetapi antrean gagal diperbarui. Silakan muat ulang.';
			}
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Gagal membatalkan kunjungan.';
		} finally {
			cancellingVisitId = null;
		}
	}

	function openAssessment(patient: Patient) {
		if (patient.status !== 'REGISTERED' || isQueueLoading || cancellingVisitId) return;
		actionError = '';
		actionMessage = '';
		assessmentPatient = patient;
	}

	function resetHistoryFilters() {
		historySearch = '';
		selectedHistoryPatientId = '';
		historyMedicalRecordFilter = '';
	}

	async function openHistory(patient: Patient) {
		if (patient.medicalRecordNumber === '-') return;

		resetHistoryFilters();
		selectedHistoryVisitId = null;
		historyMedicalRecordFilter = patient.medicalRecordNumber.trim();
		activeMenu = 'riwayat';
		isSidebarOpen = false;
		await historyStore.load();
	}

	async function handleMenuSelect(menu: string) {
		activeMenu = menu;
		isSidebarOpen = false;
		selectedHistoryVisitId = null;
		actionError = '';
		actionMessage = '';

		if (menu === 'riwayat') {
			resetHistoryFilters();
			await historyStore.load();
		}
	}

	async function reloadCurrentView() {
		if (isHistoryMenu) {
			await historyStore.load();
		} else if (isBmhpMenu) {
			// Data masih dummy lokal — tidak ada yang perlu di-fetch dari server.
			actionError = '';
			actionMessage = 'Data stok & pemakaian bersumber dari data lokal (dummy).';
		} else {
			await fetchQueue();
		}
	}

	function statusClass(status: VisitStatus): string {
		return {
			REGISTERED: 'bg-amber-50 text-amber-700 ring-amber-200',
			NURSE_CHECKED: 'bg-teal-50 text-teal-700 ring-teal-200',
			DOCTOR_EXAMINED: 'bg-sky-50 text-sky-700 ring-sky-200',
			CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
			COMPLETED: 'bg-slate-100 text-slate-700 ring-slate-200'
		}[status];
	}

	function payerClass(payer: string): string {
		switch (payer.toUpperCase()) {
			case 'BPJS':
				return 'bg-emerald-50 text-emerald-700';
			case 'B2B':
				return 'bg-violet-50 text-violet-700';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}

	function timeLabel(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	function dateTimeLabel(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';

		return date.toLocaleString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// =====================================================================
	// MODUL BMHP / ALKES — STOK RUANGAN & PENCATATAN PEMAKAIAN (DUMMY LOKAL)
	// =====================================================================
	// Catatan integrasi backend (belum diimplementasikan):
	//   - Unit/poli asal diambil otomatis dari sesi (cookie), tanpa dropdown.
	//   - POST /nurse/bmhp/usage   -> body { unit_id, patient_name?, note?, items[] }
	//   - GET  /nurse/bmhp/stock   -> daftar stok depo ruangan perawat
	//   - PATCH /nurse/bmhp/stock  -> (internal) potong stok setelah usage
	//   - POST /nurse/bmhp/requests-> pengajuan amprahan/restock ke Gudang Utama
	// =====================================================================
	type BmhpItem = {
		id: string;
		code: string;
		name: string;
		category: 'BMHP' | 'ALKES';
		unit: string;
		stock: number;
		min_stock: number;
		location: string;
	};

	type BmhpUsageEntry = {
		id: string;
		item_id: string;
		item_code: string;
		item_name: string;
		unit: string;
		quantity: number;
		patient_name: string;
		note: string;
		recorded_at: string;
		recorded_by: string;
	};

	type BmhpRequest = {
		id: string;
		no_pengajuan: string;
		item_id: string;
		item_name: string;
		unit: string;
		quantity: number;
		status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
		created_at: string;
		to_warehouse: string;
	};

	type BmhpCartLine = {
		item_id: string;
		quantity: number;
	};

	// --- Data dummy: stok depo ruangan perawat saat ini -------------------
	let roomStock = $state<BmhpItem[]>([
		{ id: 'bmhp_01', code: 'BMH-SPT-3CC', name: 'Spuit 3cc', category: 'BMHP', unit: 'Pcs', stock: 24, min_stock: 50, location: 'Depo Poli Umum' },
		{ id: 'bmhp_02', code: 'BMH-INF-SET', name: 'Infus Set Dewasa', category: 'BMHP', unit: 'Set', stock: 12, min_stock: 20, location: 'Depo Poli Umum' },
		{ id: 'bmhp_03', code: 'BMH-PVD-60', name: 'Antiseptik Povidone Iodine 60ml', category: 'BMHP', unit: 'Botol', stock: 9, min_stock: 6, location: 'Depo Poli Umum' },
		{ id: 'bmhp_04', code: 'BMH-PRB-4', name: 'Perban Elastis 4 inci', category: 'BMHP', unit: 'Roll', stock: 18, min_stock: 10, location: 'Depo Poli Umum' },
		{ id: 'bmhp_05', code: 'BMH-HSC-75', name: 'Handscoon Steril 7.5', category: 'BMHP', unit: 'Pasang', stock: 41, min_stock: 30, location: 'Depo Poli Umum' },
		{ id: 'bmhp_06', code: 'BMH-ALC-SWB', name: 'Alkohol Swab', category: 'BMHP', unit: 'Box', stock: 6, min_stock: 10, location: 'Depo Poli Umum' },
		{ id: 'bmhp_07', code: 'BMH-IVC-20', name: 'IV Catheter 20G', category: 'BMHP', unit: 'Pcs', stock: 30, min_stock: 25, location: 'Depo Poli Umum' },
		{ id: 'bmhp_08', code: 'BMH-KAT-16', name: 'Kateter Urine 16Fr', category: 'BMHP', unit: 'Pcs', stock: 10, min_stock: 5, location: 'Depo Poli Umum' },
		{ id: 'bmhp_09', code: 'ALK-TEN-DG', name: 'Tensimeter Digital Lengan', category: 'ALKES', unit: 'Pcs', stock: 2, min_stock: 1, location: 'Depo Poli Umum' },
		{ id: 'bmhp_10', code: 'ALK-THR-IR', name: 'Termometer Infrared', category: 'ALKES', unit: 'Pcs', stock: 1, min_stock: 2, location: 'Depo Poli Umum' }
	]);

	// --- Data dummy: histori pemakaian (USAGE) ---------------------------
	let usageHistory = $state<BmhpUsageEntry[]>([
		{
			id: 'use_001',
			item_id: 'bmhp_01',
			item_code: 'BMH-SPT-3CC',
			item_name: 'Spuit 3cc',
			unit: 'Pcs',
			quantity: 2,
			patient_name: 'Ayu Putri Lestari',
			note: 'Injeksi IM',
			recorded_at: '2026-01-14T09:12:00',
			recorded_by: 'Ns. Dewi'
		},
		{
			id: 'use_002',
			item_id: 'bmhp_05',
			item_code: 'BMH-HSC-75',
			item_name: 'Handscoon Steril 7.5',
			unit: 'Pasang',
			quantity: 1,
			patient_name: 'Budi Santoso',
			note: 'Perawatan luka',
			recorded_at: '2026-01-14T09:40:00',
			recorded_by: 'Ns. Dewi'
		},
		{
			id: 'use_003',
			item_id: 'bmhp_03',
			item_code: 'BMH-PVD-60',
			item_name: 'Antiseptik Povidone Iodine 60ml',
			unit: 'Botol',
			quantity: 1,
			patient_name: 'Siti Aminah',
			note: 'Desinfeksi area injeksi',
			recorded_at: '2026-01-13T14:05:00',
			recorded_by: 'Ns. Dewi'
		}
	]);

	// --- Data dummy: pengajuan amprahan ke Gudang Utama ------------------
	let bmhpRequests = $state<BmhpRequest[]>([]);

	// --- State: UI modul BMHP --------------------------------------------
	let bmhpActiveTab = $state<'usage' | 'stock'>('usage');
	let bmhpSearch = $state('');
	let usageItemId = $state('');
	let usageQty = $state(1);
	let usagePatient = $state('');
	let usageNote = $state('');
	let usageCart = $state<BmhpCartLine[]>([]);

	// --- Derived: ringkasan stok -----------------------------------------
	let lowStockBmhp = $derived(roomStock.filter((item) => item.stock <= item.min_stock));

	let filteredStock = $derived.by(() => {
		const query = bmhpSearch.trim().toLocaleLowerCase('id-ID');
		if (!query) return roomStock;

		return roomStock.filter((item) =>
			[item.name, item.code, item.category, item.location].some((value) =>
				value.toLocaleLowerCase('id-ID').includes(query)
			)
		);
	});

	let usageTodayCount = $derived(
		usageHistory.filter((entry) => {
			const date = new Date(entry.recorded_at);
			const now = new Date();
			return (
				date.getFullYear() === now.getFullYear() &&
				date.getMonth() === now.getMonth() &&
				date.getDate() === now.getDate()
			);
		}).length
	);

	// --- Helpers ----------------------------------------------------------
	function getStockItem(id: string): BmhpItem | undefined {
		return roomStock.find((item) => item.id === id);
	}

	function isLowStock(item: BmhpItem): boolean {
		return item.stock <= item.min_stock;
	}

	function bmhpCategoryLabel(category: string): string {
		return category === 'ALKES' ? 'Alat Kesehatan' : 'Bahan Habis Pakai';
	}

	function bmhpCategoryClass(category: string): string {
		return category === 'ALKES'
			? 'bg-violet-50 text-violet-700 ring-violet-200'
			: 'bg-teal-50 text-teal-700 ring-teal-200';
	}

	function stockStatusMeta(item: BmhpItem): { label: string; class: string } {
		if (item.stock <= 0) {
			return { label: 'Habis', class: 'bg-rose-100 text-rose-700 ring-rose-200' };
		}
		if (isLowStock(item)) {
			return { label: 'Menipis', class: 'bg-amber-100 text-amber-700 ring-amber-200' };
		}
		return { label: 'Aman', class: 'bg-emerald-100 text-emerald-700 ring-emerald-200' };
	}

	function pendingRequestFor(itemId: string): BmhpRequest | undefined {
		return bmhpRequests.find(
			(request) =>
				request.item_id === itemId &&
				(request.status === 'PENDING' || request.status === 'PROCESSING')
		);
	}

	function requestStatusClass(status: BmhpRequest['status']): string {
		switch (status) {
			case 'PENDING':
				return 'bg-amber-100 text-amber-700 ring-amber-200';
			case 'PROCESSING':
				return 'bg-sky-100 text-sky-700 ring-sky-200';
			case 'COMPLETED':
				return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
			default:
				return 'bg-rose-100 text-rose-700 ring-rose-200';
		}
	}

	// --- Actions: pencatatan pemakaian ------------------------------------
	function addUsageToCart() {
		actionError = '';
		actionMessage = '';

		if (!usageItemId) {
			actionError = 'Pilih item BMHP/Alkes terlebih dahulu.';
			return;
		}

		const item = getStockItem(usageItemId);
		if (!item) {
			actionError = 'Item tidak ditemukan pada stok ruangan.';
			return;
		}

		const quantity = Number(usageQty);
		if (!Number.isFinite(quantity) || quantity < 1) {
			actionError = 'Jumlah pemakaian minimal 1.';
			return;
		}

		const existing = usageCart.find((line) => line.item_id === item.id);
		const alreadyQueued = existing ? existing.quantity : 0;

		if (alreadyQueued + quantity > item.stock) {
			actionError = `Stok ${item.name} tidak cukup (sisa ${item.stock} ${item.unit}).`;
			return;
		}

		if (existing) {
			usageCart = usageCart.map((line) =>
				line.item_id === item.id ? { ...line, quantity: line.quantity + quantity } : line
			);
		} else {
			usageCart = [...usageCart, { item_id: item.id, quantity }];
		}

		usageItemId = '';
		usageQty = 1;
	}

	function removeUsageLine(index: number) {
		usageCart = usageCart.filter((_, i) => i !== index);
	}

	function clearUsageCart() {
		usageCart = [];
	}

	function commitUsage() {
		actionError = '';
		actionMessage = '';

		if (usageCart.length === 0) {
			actionError = 'Tambahkan minimal satu item sebelum menyimpan pemakaian.';
			return;
		}

		for (const line of usageCart) {
			const item = getStockItem(line.item_id);
			if (!item) {
				actionError = 'Ada item yang tidak lagi tersedia pada stok ruangan.';
				return;
			}
			if (line.quantity > item.stock) {
				actionError = `Stok ${item.name} tidak cukup (sisa ${item.stock} ${item.unit}).`;
				return;
			}
		}

		const now = new Date().toISOString();
		const recordedBy = currentUser.name || 'Perawat';
		const patientName = usagePatient.trim();
		const note = usageNote.trim();

		const newEntries: BmhpUsageEntry[] = usageCart.map((line) => {
			const item = getStockItem(line.item_id) as BmhpItem;
			return {
				id: `use_${Date.now()}_${item.id}`,
				item_id: item.id,
				item_code: item.code,
				item_name: item.name,
				unit: item.unit,
				quantity: line.quantity,
				patient_name: patientName,
				note,
				recorded_at: now,
				recorded_by: recordedBy
			};
		});

		// Simulasi potong stok lokal.
		roomStock = roomStock.map((item) => {
			const line = usageCart.find((entry) => entry.item_id === item.id);
			return line ? { ...item, stock: Math.max(0, item.stock - line.quantity) } : item;
		});

		usageHistory = [...newEntries, ...usageHistory];
		usageCart = [];
		usagePatient = '';
		usageNote = '';

		actionMessage = `Pemakaian ${newEntries.length} item BMHP berhasil dicatat pada unit ${activeUnit}.`;
	}

	// --- Actions: pengajuan amprahan / restock ----------------------------
	function quickRestock(item: BmhpItem) {
		actionError = '';
		actionMessage = '';

		const existing = pendingRequestFor(item.id);
		if (existing) {
			actionError = `Pengajuan untuk ${item.name} masih diproses (${existing.no_pengajuan}).`;
			return;
		}

		const now = new Date();
		const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
		const noPengajuan = `BMHP-${stamp}-${String(bmhpRequests.length + 1).padStart(3, '0')}`;
		const suggested = Math.max(item.min_stock * 2 - item.stock, item.min_stock);

		bmhpRequests = [
			{
				id: `req_${now.getTime()}`,
				no_pengajuan: noPengajuan,
				item_id: item.id,
				item_name: item.name,
				unit: item.unit,
				quantity: suggested,
				status: 'PENDING',
				created_at: now.toISOString(),
				to_warehouse: 'Gudang Utama / Farmasi'
			},
			...bmhpRequests
		];

		actionMessage = `Amprahan ${noPengajuan} untuk ${item.name} (${suggested} ${item.unit}) dikirim ke Gudang Utama.`;
	}

	onMount(async () => {
		todayLabel = new Date().toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		try {
			const profile = await validateSession();
			if (!['nurse', 'perawat'].includes(profile.role.toLowerCase())) {
				isForbidden = true;
			} else {
				currentUser = profile;
				activeUnit = sessionUnit(profile);
				await fetchQueue();
			}
		} catch (error) {
			console.error('Gagal verifikasi sesi perawat:', error);
			isForbidden = true;
		} finally {
			isLoading = false;
		}
	});
</script>

<Title title={isHistoryMenu ? 'Perawat | Riwayat Pasien' : isBmhpMenu ? 'Perawat | Stok & Pemakaian BMHP' : 'Perawat | Antrean Poli'} />

<div class="flex h-screen overflow-hidden bg-[#f3f8f7] font-sans text-slate-900">
	{#if isLoading}
		<SidebarSkeleton />
	{:else if !isForbidden}
		<Sidebar
			role="perawat"
			{activeMenu}
			isOpen={isSidebarOpen}
			onMenuSelect={handleMenuSelect}
			onClose={() => (isSidebarOpen = false)}
		/>
	{/if}

	<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if isForbidden}
			<ErrorState status={403} />
		{:else}
			<header class="flex items-center justify-between border-b border-teal-100 bg-white px-5 py-4 shadow-sm lg:hidden">
				<button type="button" aria-label="Buka menu" class="text-teal-700" onclick={() => (isSidebarOpen = true)}>
					<span class="text-2xl">☰</span>
				</button>
				<span class="text-xs font-bold text-teal-700">{currentUser.user_code || currentUser.id}</span>
			</header>

			<div class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
				<div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p class="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase">Panel keperawatan</p>
						<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900">
							{pageHeading}
						</h1>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<span class="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-200 ring-inset">
								🏥 Unit: {activeUnit}
							</span>
							<p class="text-sm text-slate-500">{pageSubtitle}</p>
						</div>
					</div>
					<button
						type="button"
						class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-sm hover:bg-teal-50 disabled:opacity-50"
						disabled={isLoading || currentLoading || cancellingVisitId !== null}
						onclick={reloadCurrentView}
					>
						{currentLoading ? 'Memuat...' : 'Muat ulang'}
					</button>
				</div>

				{#if isHistoryMenu}
					{#if historyStore.error}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{historyStore.error}
							{#if historyStore.loaded}
								<p class="mt-1">Data yang ditampilkan mungkin belum terbaru.</p>
							{/if}
						</div>
					{/if}

					<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 p-5">
							<h2 class="font-bold text-slate-900">Daftar Riwayat Pasien</h2>
							<p class="mt-1 text-sm text-slate-500">
								Pilih Detail untuk melihat informasi kunjungan dan asesmen perawat.
							</p>

							<div class="mt-4 grid gap-3 md:grid-cols-2">
								<div>
									<label for="history-search" class="mb-1 block text-xs font-semibold text-slate-600">
										Cari riwayat
									</label>
									<input
										id="history-search"
										type="search"
										bind:value={historySearch}
										placeholder="Nama, rekam medis, keluhan, atau status"
										class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
									/>
								</div>
								<div>
									<label for="history-patient" class="mb-1 block text-xs font-semibold text-slate-600">
										Filter pasien
									</label>
									<select
										id="history-patient"
										bind:value={selectedHistoryPatientId}
										onchange={() => (historyMedicalRecordFilter = '')}
										class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
									>
										<option value="">Semua pasien</option>
										{#each historyPatients as patient (patient.id)}
											<option value={patient.id}>
												{patient.name} — {patient.medicalRecordNumber}
											</option>
										{/each}
									</select>
								</div>
							</div>

							{#if historyMedicalRecordFilter}
								<p class="mt-3 text-xs font-semibold text-teal-700">
									Rekam medis terpilih: {historyMedicalRecordFilter}
								</p>
							{/if}

							<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
								<p class="text-xs text-slate-500" aria-live="polite">
									{filteredHistory.length} dari {historyStore.visits.length} kunjungan
								</p>
								{#if historySearch || selectedHistoryPatientId || historyMedicalRecordFilter}
									<button
										type="button"
										class="text-xs font-semibold text-teal-700 hover:text-teal-900"
										onclick={resetHistoryFilters}
									>
										Hapus filter
									</button>
								{/if}
							</div>
						</div>

						{#if historyStore.loading}
							<p class="border-b border-slate-100 px-5 py-3 text-sm text-slate-500" role="status">
								Memuat riwayat pasien...
							</p>
						{/if}

						<div class="overflow-x-auto" aria-busy={historyStore.loading}>
							<table class="w-full min-w-[800px] text-left text-sm">
								<caption class="sr-only">Daftar riwayat kunjungan pasien</caption>
								<thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
									<tr>
										<th scope="col" class="px-5 py-3">Pasien</th>
										<th scope="col" class="px-5 py-3">Tanggal kunjungan</th>
										<th scope="col" class="px-5 py-3">Keluhan</th>
										<th scope="col" class="min-w-[240px] px-5 py-3">Status</th>
										<th scope="col" class="w-36 px-5 py-3 text-center">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each filteredHistory as visit (visit.visitId)}
										<tr class="align-middle hover:bg-teal-50/30">
											<td class="px-5 py-4">
												<p class="font-semibold text-slate-900">{visit.patient.name}</p>
												<p class="mt-1 text-xs text-slate-500">{visit.patient.medicalRecordNumber}</p>
											</td>
											<td class="px-5 py-4 text-slate-600">
												{dateTimeLabel(visit.date)}
											</td>
											<td class="px-5 py-4 text-slate-600">
												<p class="max-w-[200px] truncate">
													{visit.complaint?.trim() || '-'}
												</p>
											</td>
											<td class="px-5 py-4">
												<span
													title={visit.status}
													class={`status-badge ring-1 ring-inset ${statusClass(visit.status)}`}
												>
													<span class="status-dot" aria-hidden="true"></span>
													{statusLabels[visit.status]}
												</span>
											</td>
											<td class="px-5 py-4 text-center">
												<button
													type="button"
													aria-label={`Lihat detail kunjungan ${visit.patient.name}, ${dateTimeLabel(visit.date)}`}
													aria-haspopup="dialog"
													class="table-action table-action-secondary"
													onclick={() => (selectedHistoryVisitId = visit.visitId)}
												>
													Detail
												</button>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="5" class="px-5 py-14 text-center text-sm text-slate-500">
												{historyStore.loading
													? 'Memuat riwayat pasien...'
													: historyStore.error
														? 'Riwayat gagal dimuat. Silakan tekan Muat ulang.'
														: historySearch || selectedHistoryPatientId || historyMedicalRecordFilter
															? 'Tidak ada riwayat yang sesuai dengan filter.'
															: 'Belum ada riwayat pasien.'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{:else if isBmhpMenu}
					{#if actionError}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{actionError}
						</div>
					{/if}

					{#if actionMessage}
						<div class="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700" role="status">
							{actionMessage}
						</div>
					{/if}

					<!-- Konteks unit (dari sesi) + ringkasan + tab switcher -->
					<div class="mb-5 flex flex-col gap-4 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
						<div class="flex items-start gap-3">
							<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-xl ring-1 ring-teal-200">
								🏥
							</div>
							<div>
								<p class="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
									Unit / Poli Aktif (dari sesi)
								</p>
								<p class="text-lg font-black text-teal-800">{activeUnit}</p>
								<p class="text-xs text-slate-500">
									Petugas: {currentUser.name || 'Perawat'} · Depo BMHP ruangan {activeUnit}
								</p>
							</div>
						</div>

						<div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
							<div class="flex flex-wrap gap-2">
								<span class="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 ring-inset">
									📦 {roomStock.length} item
								</span>
								<span class={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ring-1 ring-inset ${lowStockBmhp.length > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
									⚠️ {lowStockBmhp.length} menipis
								</span>
								<span class="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 ring-inset">
									📝 {usageTodayCount} pemakaian hari ini
								</span>
							</div>

							<div class="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
								<button
									type="button"
									class={`rounded-[10px] px-4 py-2 text-xs font-bold transition ${bmhpActiveTab === 'usage' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
									onclick={() => (bmhpActiveTab = 'usage')}
								>
									📝 Catat Pemakaian
								</button>
								<button
									type="button"
									class={`rounded-[10px] px-4 py-2 text-xs font-bold transition ${bmhpActiveTab === 'stock' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
									onclick={() => (bmhpActiveTab = 'stock')}
								>
									📦 Stok Ruangan
								</button>
							</div>
						</div>
					</div>

					{#if bmhpActiveTab === 'usage'}
						<div class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
							<!-- Form pencatatan pemakaian -->
							<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
								<h2 class="font-bold text-slate-900">Form Pencatatan Pemakaian</h2>
								<p class="mt-1 text-xs text-slate-500">
									Catat BMHP/Alkes yang dipakai setelah tindakan. Stok ruangan otomatis berkurang saat disimpan.
								</p>

								<div class="mt-4 grid gap-3 sm:grid-cols-2">
									<div>
										<label for="bmhp-patient" class="mb-1 block text-xs font-semibold text-slate-600">
											Nama pasien (opsional)
										</label>
										<input
											id="bmhp-patient"
											bind:value={usagePatient}
											placeholder="Misal: Ayu Putri Lestari"
											class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
										/>
									</div>
									<div>
										<label for="bmhp-note" class="mb-1 block text-xs font-semibold text-slate-600">
											Tindakan / catatan
										</label>
										<input
											id="bmhp-note"
											bind:value={usageNote}
											placeholder="Misal: injeksi IM, perawatan luka"
											class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
										/>
									</div>
								</div>

								<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
									<p class="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
										Tambah item dari stok ruangan
									</p>
									<div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
										<div>
											<label for="bmhp-item" class="sr-only">Pilih item BMHP</label>
											<select
												id="bmhp-item"
												bind:value={usageItemId}
												class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
											>
												<option value="">-- Pilih item --</option>
												{#each roomStock as item (item.id)}
													<option value={item.id} disabled={item.stock <= 0}>
														{item.name} · sisa {item.stock} {item.unit}
													</option>
												{/each}
											</select>
										</div>
										<div>
											<label for="bmhp-qty" class="sr-only">Jumlah</label>
											<input
												id="bmhp-qty"
												type="number"
												min="1"
												bind:value={usageQty}
												class="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-bold focus:border-teal-500 focus:outline-none"
											/>
										</div>
										<button
											type="button"
											class="table-action table-action-primary"
											onclick={addUsageToCart}
										>
											➕ Tambah
										</button>
									</div>
								</div>

								<div class="mt-4">
									<p class="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
										Item tercatat dalam sesi ini ({usageCart.length})
									</p>

									{#if usageCart.length === 0}
										<div class="rounded-xl border-2 border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
											Belum ada item. Tambahkan minimal 1 item di atas.
										</div>
									{:else}
										<ul class="space-y-2">
											{#each usageCart as line, i (line.item_id)}
												{@const stockItem = getStockItem(line.item_id)}
												<li class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
													<div class="min-w-0">
														<p class="truncate text-xs font-bold text-slate-900">
															{stockItem?.name ?? 'Item'}
														</p>
														<p class="text-[10px] text-slate-500">
															<span class="font-mono">{stockItem?.code ?? '-'}</span>
															· sisa saat ini {stockItem?.stock ?? 0} {stockItem?.unit ?? ''}
														</p>
													</div>
													<div class="flex shrink-0 items-center gap-2">
														<span class="rounded bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
															{line.quantity} {stockItem?.unit ?? ''}
														</span>
														<button
															type="button"
															class="table-action table-action-danger"
															onclick={() => removeUsageLine(i)}
														>
															Hapus
														</button>
													</div>
												</li>
											{/each}
										</ul>

										<div class="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3">
											<button
												type="button"
												class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
												onclick={clearUsageCart}
											>
												Kosongkan
											</button>
											<button
												type="button"
												class="rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-teal-800"
												onclick={commitUsage}
											>
												✅ Simpan Pemakaian
											</button>
										</div>
									{/if}
								</div>
							</section>

							<!-- Histori pemakaian -->
							<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
								<div class="flex items-center justify-between">
									<h2 class="font-bold text-slate-900">Histori Pemakaian (USAGE)</h2>
									<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
										{usageHistory.length} entri
									</span>
								</div>
								<p class="mt-1 text-xs text-slate-500">
									Riwayat pemakaian BMHP pada unit {activeUnit}.
								</p>

								<ul class="mt-4 space-y-2">
									{#each usageHistory.slice(0, 12) as entry (entry.id)}
										<li class="rounded-xl border border-slate-200 bg-slate-50 p-3">
											<div class="flex items-start justify-between gap-3">
												<div class="min-w-0">
													<p class="truncate text-xs font-bold text-slate-900">{entry.item_name}</p>
													<p class="text-[10px] text-slate-500">
														<span class="font-mono">{entry.item_code}</span>
														{#if entry.patient_name}· {entry.patient_name}{/if}
														{#if entry.note}· {entry.note}{/if}
													</p>
													<p class="mt-0.5 text-[10px] text-slate-400">
														{dateTimeLabel(entry.recorded_at)} · {entry.recorded_by}
													</p>
												</div>
												<span class="shrink-0 rounded bg-white px-2 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-200 ring-inset">
													-{entry.quantity} {entry.unit}
												</span>
											</div>
										</li>
									{:else}
										<li class="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
											Belum ada pemakaian tercatat.
										</li>
									{/each}
								</ul>
							</section>
						</div>
					{:else}
						<!-- Monitoring stok ruangan -->
						{#if lowStockBmhp.length > 0}
							<div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
								<div class="flex items-center gap-3">
									<span class="text-2xl">⚠️</span>
									<div>
										<p class="text-sm font-bold text-amber-800">
											{lowStockBmhp.length} item BMHP di bawah / menyentuh batas minimum
										</p>
										<p class="text-xs text-amber-700">
											Segera ajukan amprahan ke Gudang Utama untuk menghindari kekosongan stok.
										</p>
									</div>
								</div>
								<button
									type="button"
									class="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-amber-700"
									onclick={() => (bmhpSearch = '')}
								>
									Lihat semua item
								</button>
							</div>
						{/if}

						<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
							<div class="border-b border-slate-100 p-5">
								<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<h2 class="font-bold text-slate-900">Stok BMHP & Alkes Ruangan</h2>
										<p class="mt-1 text-xs text-slate-500">
											Daftar sisa stok di depo unit {activeUnit}. Peringatan otomatis muncul bila stok menipis.
										</p>
									</div>
									<div class="w-full sm:w-72">
										<label for="bmhp-search" class="sr-only">Cari item stok</label>
										<input
											id="bmhp-search"
											type="search"
											bind:value={bmhpSearch}
											placeholder="Cari nama / kode item..."
											class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
										/>
									</div>
								</div>
								<p class="mt-2 text-xs text-slate-500" aria-live="polite">
									Menampilkan {filteredStock.length} dari {roomStock.length} item
								</p>
							</div>

							<div class="overflow-x-auto">
								<table class="w-full min-w-[900px] text-left text-sm">
									<caption class="sr-only">Daftar stok BMHP dan alat kesehatan di ruangan</caption>
									<thead class="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
										<tr>
											<th scope="col" class="px-5 py-3">Kode</th>
											<th scope="col" class="px-5 py-3">Item</th>
											<th scope="col" class="px-5 py-3">Kategori</th>
											<th scope="col" class="px-5 py-3 text-center">Sisa stok</th>
											<th scope="col" class="px-5 py-3 text-center">Min</th>
											<th scope="col" class="px-5 py-3">Status</th>
											<th scope="col" class="min-w-[190px] px-5 py-3 text-center">Aksi cepat</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100">
										{#each filteredStock as stockItem (stockItem.id)}
											{@const statusMeta = stockStatusMeta(stockItem)}
											{@const pending = pendingRequestFor(stockItem.id)}
											<tr class={`align-middle ${isLowStock(stockItem) ? 'bg-amber-50/40' : ''} hover:bg-teal-50/30`}>
												<td class="px-5 py-4 font-mono text-xs font-bold text-slate-700">
													{stockItem.code}
												</td>
												<td class="px-5 py-4">
													<p class="font-semibold text-slate-900">{stockItem.name}</p>
													<p class="mt-0.5 text-xs text-slate-400">{stockItem.location}</p>
												</td>
												<td class="px-5 py-4">
													<span class={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${bmhpCategoryClass(stockItem.category)}`}>
														{bmhpCategoryLabel(stockItem.category)}
													</span>
												</td>
												<td class="px-5 py-4 text-center">
													<span class={`rounded-full px-3 py-1 text-xs font-black ring-1 ring-inset ${statusMeta.class}`}>
														{stockItem.stock} {stockItem.unit}
													</span>
												</td>
												<td class="px-5 py-4 text-center text-xs text-slate-500">
													{stockItem.min_stock} {stockItem.unit}
												</td>
												<td class="px-5 py-4">
													<span
														title={statusMeta.label}
														class={`status-badge ring-1 ring-inset ${statusMeta.class}`}
													>
														<span class="status-dot" aria-hidden="true"></span>
														{statusMeta.label}
													</span>
												</td>
												<td class="px-5 py-4">
													{#if pending}
														<div class="flex flex-col items-center gap-1">
															<span class={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${requestStatusClass(pending.status)}`}>
																Menunggu · {pending.no_pengajuan}
															</span>
															<span class="text-[10px] text-slate-400">
																{pending.quantity} {pending.unit} diajukan
															</span>
														</div>
													{:else}
														<button
															type="button"
															class="table-action table-action-secondary"
															onclick={() => quickRestock(stockItem)}
														>
															📤 Ajukan Amprahan
														</button>
													{/if}
												</td>
											</tr>
										{:else}
											<tr>
												<td colspan="7" class="px-5 py-14 text-center text-sm text-slate-500">
													Tidak ada item yang sesuai dengan pencarian.
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</section>

						<!-- Riwayat pengajuan amprahan (dummy) -->
						<section class="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
							<div class="flex items-center justify-between">
								<h2 class="font-bold text-slate-900">Riwayat Amprahan ke Gudang Utama</h2>
								<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
									{bmhpRequests.length} pengajuan
								</span>
							</div>
							<p class="mt-1 text-xs text-slate-500">
								Pengajuan restock/amprahan BMHP yang dikirim dari unit {activeUnit}.
							</p>

							<ul class="mt-4 space-y-2">
								{#each bmhpRequests as request (request.id)}
									<li class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
										<div class="min-w-0">
											<p class="text-xs font-bold text-slate-900">{request.item_name}</p>
											<p class="text-[10px] text-slate-500">
												<span class="font-mono">{request.no_pengajuan}</span>
												· {request.quantity} {request.unit} · ke {request.to_warehouse}
											</p>
											<p class="mt-0.5 text-[10px] text-slate-400">
												{dateTimeLabel(request.created_at)}
											</p>
										</div>
										<span class={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${requestStatusClass(request.status)}`}>
											{request.status}
										</span>
									</li>
								{:else}
									<li class="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
										Belum ada pengajuan amprahan.
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{:else}
					{#if loadError}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{loadError}
							{#if patients.length > 0}
								<p class="mt-1">Data yang ditampilkan mungkin belum terbaru.</p>
							{/if}
						</div>
					{/if}

					{#if actionError}
						<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
							{actionError}
						</div>
					{/if}

					{#if actionMessage}
						<div class="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700" role="status">
							{actionMessage}
						</div>
					{/if}

					{#if isLoading || isQueueLoading}
						<p class="mb-5 text-sm text-slate-500" role="status">Memuat antrean pasien...</p>
					{/if}

					<div class="mb-5 grid gap-3 sm:grid-cols-3">
						<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Total kunjungan</p>
							<p class="mt-1 text-2xl font-black">{patients.length}</p>
						</div>
						<div class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Menunggu asesmen</p>
							<p class="mt-1 text-2xl font-black text-amber-600">
								{patients.filter((patient) => patient.status === 'REGISTERED').length}
							</p>
						</div>
						<div class="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm">
							<p class="text-xs font-bold text-slate-500 uppercase">Status NURSE_CHECKED</p>
							<p class="mt-1 text-2xl font-black text-teal-600">
								{patients.filter((patient) => patient.status === 'NURSE_CHECKED').length}
							</p>
						</div>
					</div>

					<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
						<div class="border-b border-slate-100 px-5 py-4">
							<h2 class="font-bold text-slate-900">Daftar pasien hari ini</h2>
							<p class="mt-1 text-xs text-slate-500">
								Fitur panggil pasien belum tersedia. Menyimpan asesmen akan mengubah status menjadi NURSE_CHECKED.
							</p>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full min-w-[1100px] text-left text-sm">
								<thead class="bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
									<tr>
										<th scope="col" class="px-5 py-4">Antrean / Jam daftar</th>
										<th scope="col" class="px-5 py-4">Rekam medis / Pasien</th>
										<th scope="col" class="px-5 py-4">Jenis kelamin / Umur</th>
										<th scope="col" class="px-5 py-4">Jadwal praktik</th>
										<th scope="col" class="px-5 py-4">Penjamin</th>
										<th scope="col" class="min-w-[240px] px-5 py-4 whitespace-nowrap">Status kunjungan</th>
										<th scope="col" class="w-60 min-w-[240px] border-l border-slate-200/70 px-5 py-4 text-center">Aksi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each patients as patient (patient.visitId)}
										<tr class="align-middle hover:bg-teal-50/30">
											<td class="px-5 py-4">
												<p class="font-black text-teal-700">{patient.queueNumber}</p>
												<p class="mt-1 text-xs text-slate-500">{timeLabel(patient.registrationTime)}</p>
											</td>
											<td class="px-5 py-4">
												<p class="font-bold text-slate-900">{patient.medicalRecordNumber}</p>
												<p class="mt-1 text-slate-600">{patient.patientName}</p>
											</td>
											<td class="px-5 py-4 text-slate-600">
												{patient.gender}<br /><span class="text-xs">{patient.age ?? '-'} tahun</span>
											</td>
											<td class="px-5 py-4 text-slate-600">
												<p class="font-semibold">{patient.slot.name}</p>
												<p class="mt-1 text-xs">{patient.slot.startHour} – {patient.slot.endHour}</p>
											</td>
											<td class="px-5 py-4">
												<span class={`rounded-lg px-2.5 py-1 text-xs font-bold ${payerClass(patient.payerType)}`}>
													{patient.payerType}
												</span>
											</td>
											<td class="px-5 py-4">
												<div class="flex flex-col items-start gap-2">
													<span
														title={patient.status}
														class={`status-badge ring-1 ring-inset ${statusClass(patient.status)}`}
													>
														<span class="status-dot" aria-hidden="true"></span>
														{statusLabels[patient.status]}
													</span>
													{#if patient.status === 'NURSE_CHECKED'}
														<span class="flex items-center gap-1.5 pl-3 text-xs font-medium text-teal-700">
															<svg
																xmlns="http://www.w3.org/2000/svg"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																class="h-3.5 w-3.5 shrink-0"
																aria-hidden="true"
															>
																<path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6" />
															</svg>
															Asesmen tersimpan
														</span>
													{/if}
												</div>
											</td>
											<td class="border-l border-slate-100 px-5 py-4">
												<div
													class="grid w-full gap-2"
													role="group"
													aria-label={`Aksi kunjungan ${patient.patientName}`}
												>
													{#if patient.status === 'REGISTERED'}
														<button
															type="button"
															class="table-action table-action-primary"
															aria-haspopup="dialog"
															disabled={isQueueLoading || cancellingVisitId !== null}
															onclick={() => openAssessment(patient)}
														>
															Input Asesmen Perawat
														</button>
														<button
															type="button"
															class="table-action table-action-unavailable"
															disabled
															title="Mekanisme notifikasi panggilan belum diimplementasikan"
														>
															<span>Panggil pasien</span>
															<span class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] leading-none font-semibold">
																Segera
															</span>
														</button>
													{/if}

													<button
														type="button"
														class="table-action table-action-secondary"
														disabled={patient.medicalRecordNumber === '-'}
														onclick={() => openHistory(patient)}
													>
														Lihat Riwayat
													</button>

													{#if canCancel(patient.status)}
														<div class="mt-1 border-t border-slate-100 pt-2">
															<button
																type="button"
																class="table-action table-action-danger"
																disabled={isQueueLoading || cancellingVisitId !== null}
																aria-busy={cancellingVisitId === patient.visitId}
																onclick={() => cancelVisit(patient)}
															>
																{cancellingVisitId === patient.visitId ? 'Membatalkan...' : 'Batalkan kunjungan'}
															</button>
														</div>
													{/if}
												</div>
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="7" class="px-5 py-14 text-center text-sm text-slate-500">
												{isLoading || isQueueLoading ? 'Memuat antrean pasien...' : loadError ? 'Antrean pasien gagal dimuat. Silakan muat ulang.' : 'Belum ada pasien pada antrean hari ini.'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			</div>
		{/if}
	</main>
</div>

{#if assessmentPatient}
	{#key assessmentPatient.visitId}
		<NursingAssessmentModal
			patient={assessmentPatient}
			open={true}
			onClose={() => (assessmentPatient = null)}
			onSaved={handleAssessmentSaved}
		/>
	{/key}
{/if}

{#if isHistoryMenu && selectedHistoryVisit && !isForbidden}
	{#key selectedHistoryVisit.visitId}
		<NursePatientHistoryDetailModal
			visit={selectedHistoryVisit}
			onClose={() => (selectedHistoryVisitId = null)}
		/>
	{/key}
{/if}

<style>
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2rem;
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.25rem;
		white-space: nowrap;
	}

	.status-dot {
		width: 0.375rem;
		height: 0.375rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: currentColor;
	}

	.table-action {
		display: inline-flex;
		width: 100%;
		min-height: 2.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid transparent;
		border-radius: 0.625rem;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.25rem;
		text-align: center;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.table-action:focus-visible {
		outline: 2px solid #0f766e;
		outline-offset: 3px;
	}

	.table-action:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.table-action-primary {
		border-color: #0f766e;
		background: #0f766e;
		color: white;
	}

	.table-action-primary:hover:not(:disabled) {
		border-color: #115e59;
		background: #115e59;
	}

	.table-action-secondary {
		border-color: #cbd5e1;
		background: white;
		color: #475569;
	}

	.table-action-secondary:hover:not(:disabled) {
		border-color: #99f6e4;
		background: #f0fdfa;
		color: #0f766e;
	}

	.table-action-danger {
		border-color: #fecdd3;
		background: #fff1f2;
		color: #be123c;
	}

	.table-action-danger:hover:not(:disabled) {
		border-color: #fda4af;
		background: #ffe4e6;
		color: #9f1239;
	}

	.table-action-danger:focus-visible {
		outline-color: #be123c;
	}

	.table-action-unavailable:disabled {
		border-color: #e2e8f0;
		border-style: dashed;
		background: #f8fafc;
		color: #64748b;
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.table-action {
			transition: none;
		}
	}
</style>
