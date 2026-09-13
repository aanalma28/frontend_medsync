<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/api';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import SidebarSkeleton from '$lib/components/skeleton/SidebarSkeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Title from '$lib/components/Title.svelte';
	import NursingAssessmentModal from '$lib/components/NursingAssessmentModal.svelte';
	import { validateSession } from '$lib/utils/getProfile';

	type VisitStatus = 'REGISTERED' | 'NURSE_CHECKED' | 'DOCTOR_EXAMINED';
	type Payer = 'Umum' | 'BPJS' | 'B2B';
	type Patient = {
		id: string;
		queueNumber: number;
		registeredAt: string;
		patientId: string;
		patientName: string;
		gender: string;
		age: number;
		payer: Payer;
		status: VisitStatus;
		complaint?: string;
		allergyHistory?: string;
		vitals?: Record<string, string | number | null>;
	};

	type History = Patient & { visits: Array<{ date: string; complaint: string; status: string; vitals: string }> };

	let isLoading = $state(true);
	let isForbidden = $state(false);
	let loadError = $state('');
	let currentUser = $state<{ name: string; id: string; user_code?: string }>({ name: '', id: '' });
	let activeMenu = $state('beranda');
	let isSidebarOpen = $state(false);
	let patients = $state<Patient[]>([]);
	let assessmentPatient = $state<Patient | null>(null);
	let historyPatient = $state<History | null>(null);
	let isHistoryLoading = $state(false);

	const today = new Date().toISOString().split('T')[0];
	const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

	function listFromResponse(response: any): any[] {
		if (Array.isArray(response)) return response;
		if (Array.isArray(response?.data)) return response.data;
		return response?.data?.patients || response?.data?.appointments || response?.patients || response?.appointments || [];
	}

	function normalizeStatus(value: string): VisitStatus {
		if (value === 'NURSE_CHECKED' || value === 'DOCTOR_EXAMINED') return value;
		if (value === 'CONFIRMED' || value === 'COMPLETED') return value === 'COMPLETED' ? 'DOCTOR_EXAMINED' : 'NURSE_CHECKED';
		return 'REGISTERED';
	}

	function normalizePatient(item: any): Patient {
		const patient = item.patient || item;
		const appointment = item.appointment || item;
		return {
			id: item.appointment_id || appointment.id || item.id,
			queueNumber: item.queue_number ?? appointment.queue_number ?? 0,
			registeredAt: item.createdAt || appointment.createdAt || item.registered_at || '-',
			patientId: patient.medical_record_number || patient.patient_code || patient.patient_id || 'RM-000',
			patientName: patient.patient_name || patient.name || 'Pasien',
			gender: patient.gender === 'LAKILAKI' || patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'PEREMPUAN' || patient.gender === 'P' ? 'Perempuan' : patient.gender || '-',
			age: Number(patient.patient_age ?? patient.age ?? 0),
			payer: (patient.payer_type || item.payer_type || item.insurance_type || 'Umum') as Payer,
			status: normalizeStatus(item.visit_status || appointment.visit_status || appointment.status),
			complaint: item.complaint || appointment.complaint || patient.complaint,
			allergyHistory: item.allergy_history || patient.allergy_history || '',
			vitals: item.nurse_assesment || appointment.nurse_assesment || null
		};
	}

	async function fetchQueue() {
		loadError = '';
		try {
			let response: any;
			try {
				response = await api.get(`/nurse/dashboard/appointments?date=${today}`);
			} catch (error) {
				if (!String(error).includes('Cannot GET')) throw error;
				response = await api.get('/doctor/practice/today-patients');
			}
			patients = listFromResponse(response).map(normalizePatient);
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Gagal memuat antrean poli.';
		}
	}

	async function openHistory(patient: Patient) {
		isHistoryLoading = true;
		historyPatient = null;
		try {
			let response: any;
			try {
				response = await api.get(`/nurse/dashboard/patients/${patient.patientId}/history`);
			} catch (error) {
				if (!String(error).includes('Cannot GET')) throw error;
				response = await api.get(`/doctor/practice/patient-history?search=${encodeURIComponent(patient.patientId)}`);
			}
			const data = response?.data || response;
			historyPatient = { ...patient, visits: data?.visits || data?.histories || listFromResponse(response).map((visit: any) => ({ date: visit.createdAt || '-', complaint: visit.complaint || '-', status: visit.status || '-', vitals: formatVitals(visit.nurse_assesment || visit.nurseAssessment) })) };
		} catch (error) {
			historyPatient = { ...patient, visits: [{ date: '-', complaint: error instanceof Error ? error.message : 'Riwayat belum tersedia.', status: '-', vitals: '-' }] };
		} finally {
			isHistoryLoading = false;
		}
	}

	function formatVitals(vitals?: Record<string, any> | null): string {
		if (!vitals) return 'Belum ada tanda vital';
		return `TD ${vitals.sistolic ?? '-'} / ${vitals.diastolic ?? '-'} mmHg · Nadi ${vitals.heart_rate ?? '-'} bpm · Suhu ${vitals.temperature ?? '-'}°C`;
	}

	function statusClass(status: VisitStatus) {
		return { REGISTERED: 'bg-amber-50 text-amber-700 ring-amber-200', NURSE_CHECKED: 'bg-teal-50 text-teal-700 ring-teal-200', DOCTOR_EXAMINED: 'bg-sky-50 text-sky-700 ring-sky-200' }[status];
	}

	function payerClass(payer: Payer) {
		return { Umum: 'bg-slate-100 text-slate-700', BPJS: 'bg-emerald-50 text-emerald-700', B2B: 'bg-violet-50 text-violet-700' }[payer] || 'bg-slate-100 text-slate-700';
	}

	function timeLabel(value: string) {
		if (value === '-') return value;
		return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	async function handleMenuSelect(menu: string) {
		activeMenu = menu;
		if (menu === 'riwayat' && patients.length === 0) await fetchQueue();
	}

	onMount(async () => {
		try {
			const profile = await validateSession();
			if (profile.role.toLowerCase() !== 'nurse' && profile.role.toLowerCase() !== 'perawat') isForbidden = true;
			else { currentUser = profile; await fetchQueue(); }
		} catch (error) {
			console.error('Gagal verifikasi sesi perawat:', error);
			isForbidden = true;
		} finally { isLoading = false; }
	});
</script>

<Title title="Perawat | Antrean Poli" />

<div class="flex h-screen overflow-hidden bg-[#f3f8f7] font-sans text-slate-900">
	{#if isLoading}<SidebarSkeleton />{:else if !isForbidden}<Sidebar role="perawat" {activeMenu} isOpen={isSidebarOpen} onMenuSelect={handleMenuSelect} onClose={() => (isSidebarOpen = false)} />{/if}
	<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{#if isForbidden}<ErrorState status={403} />{:else}
			<header class="flex items-center justify-between border-b border-teal-100 bg-white px-5 py-4 shadow-sm lg:hidden">
				<button aria-label="Buka menu" class="text-teal-700" onclick={() => (isSidebarOpen = true)}><span class="text-2xl">☰</span></button>
				<span class="text-xs font-bold text-teal-700">{currentUser.user_code || currentUser.id}</span>
			</header>
			<div class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
				<div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div><p class="text-xs font-bold tracking-[0.2em] text-teal-600 uppercase">Panel keperawatan</p><h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900">{activeMenu === 'riwayat' ? 'Riwayat Pasien' : 'Antrean Poli'}</h1><p class="mt-1 text-sm text-slate-500">{todayLabel} · Selamat bertugas, {currentUser.name || 'Perawat'}</p></div>
					<button class="rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-700 shadow-sm hover:bg-teal-50" onclick={fetchQueue}>Muat ulang</button>
				</div>
				{#if loadError}<div class="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{loadError}</div>{/if}
				{#if activeMenu === 'riwayat'}
					<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-bold text-slate-900">Riwayat pasien</h2><p class="mt-1 text-sm text-slate-500">Pilih pasien untuk melihat ringkasan kunjungan dan tanda vital.</p></div><div class="divide-y divide-slate-100">{#each patients as patient (patient.id)}<div class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p class="font-bold text-slate-900">{patient.patientName}</p><p class="mt-1 text-sm text-slate-500">{patient.patientId} · {patient.gender} · {patient.age} tahun</p><p class="mt-1 text-xs text-slate-400">Status terakhir: {patient.status}</p></div><button class="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800" onclick={() => openHistory(patient)}>Lihat Riwayat</button></div>{:else}<div class="px-5 py-14 text-center text-sm text-slate-500">Belum ada data riwayat pasien.</div>{/each}</div></section>
				{:else}
				<div class="mb-5 grid gap-3 sm:grid-cols-3"><div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs font-bold text-slate-500 uppercase">Total pasien</p><p class="mt-1 text-2xl font-black">{patients.length}</p></div><div class="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"><p class="text-xs font-bold text-slate-500 uppercase">Menunggu asesmen</p><p class="mt-1 text-2xl font-black text-amber-600">{patients.filter((patient) => patient.status === 'REGISTERED').length}</p></div><div class="rounded-2xl border border-teal-200 bg-white p-4 shadow-sm"><p class="text-xs font-bold text-slate-500 uppercase">Sudah diperiksa perawat</p><p class="mt-1 text-2xl font-black text-teal-600">{patients.filter((patient) => patient.status === 'NURSE_CHECKED').length}</p></div></div>

				<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-bold text-slate-900">Daftar pasien hari ini</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[900px] text-left text-sm"><thead class="bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase"><tr><th class="px-5 py-4">Antrean / Jam daftar</th><th class="px-5 py-4">Rekam medis / Pasien</th><th class="px-5 py-4">Jenis kelamin / Umur</th><th class="px-5 py-4">Penjamin</th><th class="px-5 py-4">Status kunjungan</th><th class="px-5 py-4">Aksi</th></tr></thead><tbody class="divide-y divide-slate-100">{#each patients as patient (patient.id)}<tr class="align-top hover:bg-teal-50/30"><td class="px-5 py-4"><p class="font-black text-teal-700">A-{String(patient.queueNumber).padStart(3, '0')}</p><p class="mt-1 text-xs text-slate-500">{timeLabel(patient.registeredAt)}</p></td><td class="px-5 py-4"><p class="font-bold text-slate-900">{patient.patientId}</p><p class="mt-1 text-slate-600">{patient.patientName}</p></td><td class="px-5 py-4 text-slate-600">{patient.gender}<br /><span class="text-xs">{patient.age} tahun</span></td><td class="px-5 py-4"><span class={`rounded-lg px-2.5 py-1 text-xs font-bold ${payerClass(patient.payer)}`}>{patient.payer}</span></td><td class="px-5 py-4"><span class={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusClass(patient.status)}`}>{patient.status}</span></td><td class="px-5 py-4"><div class="flex flex-col items-start gap-2"><button class="text-xs font-bold text-teal-700 hover:text-teal-900 disabled:cursor-not-allowed disabled:text-slate-400" disabled={patient.status !== 'REGISTERED'} onclick={() => (assessmentPatient = patient)}>{patient.status === 'REGISTERED' ? 'Input Tanda Vital' : 'Asesmen tersimpan'}</button><button class="text-xs font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800" onclick={() => openHistory(patient)}>Lihat Riwayat</button></div></td></tr>{:else}<tr><td colspan="6" class="px-5 py-14 text-center text-sm text-slate-500">Belum ada pasien pada antrean hari ini.</td></tr>{/each}</tbody></table></div></section>
			</div>
		{/if}
	</main>
</div>

{#if assessmentPatient}<NursingAssessmentModal patient={assessmentPatient} open={true} onClose={() => (assessmentPatient = null)} onSaved={fetchQueue} />{/if}

{#if historyPatient || isHistoryLoading}<div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onclick={(event) => event.target === event.currentTarget && (historyPatient = null)}><div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="history-title">{#if isHistoryLoading}<p class="py-10 text-center text-sm text-slate-500">Memuat riwayat pasien...</p>{:else if historyPatient}<div class="flex items-start justify-between"><div><p class="text-xs font-bold tracking-widest text-teal-600 uppercase">Ringkasan kunjungan</p><h2 id="history-title" class="mt-1 text-xl font-black">{historyPatient.patientName}</h2><p class="text-sm text-slate-500">{historyPatient.patientId} · {historyPatient.gender} · {historyPatient.age} tahun</p></div><button aria-label="Tutup riwayat" class="text-2xl text-slate-400" onclick={() => (historyPatient = null)}>&times;</button></div><div class="mt-5 space-y-3">{#each historyPatient.visits as visit}<div class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="flex justify-between gap-3 text-xs text-slate-500"><span>{visit.date}</span><span class="font-bold text-teal-700">{visit.status}</span></div><p class="mt-2 font-semibold text-slate-800">{visit.complaint}</p><p class="mt-1 text-xs text-slate-600">{visit.vitals}</p></div>{/each}</div>{/if}</div></div>{/if}