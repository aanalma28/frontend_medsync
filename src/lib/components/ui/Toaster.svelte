<script lang="ts">
	import { toast, type ToastVariant } from '$lib/stores/toast.svelte';

	const styles: Record<ToastVariant, string> = {
		success: 'border-emerald-200 bg-emerald-50 text-emerald-600',
		error: 'border-red-200 bg-red-50 text-red-600',
		info: 'border-blue-200 bg-blue-50 text-blue-600',
		warning: 'border-amber-200 bg-amber-50 text-amber-600'
	};

	const icons: Record<ToastVariant, string> = {
		success: '✓',
		error: '✕',
		info: 'ℹ',
		warning: '⚠'
	};
</script>

<div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
	{#each toast.items as t (t.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
			role="status"
		>
			<span
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold {styles[
					t.variant
				]}"
			>
				{icons[t.variant]}
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-slate-800">{t.title}</p>
				{#if t.description}
					<p class="mt-0.5 whitespace-pre-line text-xs text-slate-500">{t.description}</p>
				{/if}
			</div>
			<button
				type="button"
				class="shrink-0 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
				aria-label="Tutup notifikasi"
				onclick={() => toast.dismiss(t.id)}
			>
				✕
			</button>
		</div>
	{/each}
</div>
