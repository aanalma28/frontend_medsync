/** Formatter bersama untuk Dashboard Logistik. */

export function formatRupiah(value: number | null | undefined): string {
	const n = Number(value ?? 0);
	if (Number.isNaN(n)) return 'Rp0';
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		maximumFractionDigits: 0
	}).format(n);
}

export function formatNumber(value: number | null | undefined): string {
	return new Intl.NumberFormat('id-ID').format(Number(value ?? 0));
}

export function formatDate(value?: string | null): string {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return new Intl.DateTimeFormat('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(d);
}

export function formatDateTime(value?: string | null): string {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return new Intl.DateTimeFormat('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(d);
}

/** Format selisih mutasi stok: +12 / -5 */
export function formatSigned(value: number | null | undefined): string {
	const n = Number(value ?? 0);
	return `${n > 0 ? '+' : ''}${formatNumber(n)}`;
}
