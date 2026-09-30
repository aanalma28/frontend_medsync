<script lang="ts">
	import type { MetaPagination } from '$lib/stores/logistik.svelte';

	let {
		meta,
		onpage,
		label = 'data'
	}: {
		meta: MetaPagination | null;
		onpage: (page: number) => void;
		label?: string;
	} = $props();

	const pages = $derived.by(() => {
		if (!meta || meta.totalPages <= 1) return [] as number[];
		const total = meta.totalPages;
		const current = meta.page;
		const start = Math.max(1, current - 2);
		const end = Math.min(total, start + 4);
		const out: number[] = [];
		for (let i = Math.max(1, end - 4); i <= end; i++) out.push(i);
		return out;
	});

	const from = $derived(meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0);
	const to = $derived(meta ? Math.min(meta.page * meta.limit, meta.total) : 0);
</script>

{#if meta && meta.total > 0}
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm"
	>
		<p class="text-xs text-slate-500">
			Menampilkan
			<span class="font-medium text-slate-700">{from}–{to}</span>
			dari
			<span class="font-medium text-slate-700">{meta.total}</span>
			{label}
		</p>

		<div class="flex items-center gap-1">
			<button
				type="button"
				class="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={meta.page <= 1}
				onclick={() => onpage(meta.page - 1)}
			>
				‹
			</button>

			{#each pages as p (p)}
				<button
					type="button"
					class="min-w-8 rounded-lg border px-2.5 py-1 transition {p === meta.page
						? 'border-slate-900 bg-slate-900 font-medium text-white'
						: 'border-slate-200 text-slate-600 hover:bg-slate-50'}"
					onclick={() => onpage(p)}
				>
					{p}
				</button>
			{/each}

			<button
				type="button"
				class="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
				disabled={meta.page >= meta.totalPages}
				onclick={() => onpage(meta.page + 1)}
			>
				›
			</button>
		</div>
	</div>
{/if}
