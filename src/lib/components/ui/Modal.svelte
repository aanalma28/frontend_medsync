<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = false,
		title = '',
		description = '',
		size = 'md',
		onclose,
		children,
		footer
	}: {
		open?: boolean;
		title?: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		onclose?: () => void;
		children?: Snippet;
		footer?: Snippet;
	} = $props();

	const sizeClass = $derived(
		{ sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] ?? 'max-w-lg'
	);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose?.();
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-6"
		role="presentation"
		onclick={onclose}
		onkeydown={(event) => event.key === 'Escape' && onclose?.()}
	>
		<div
			class="my-6 w-full {sizeClass} rounded-xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.stopPropagation()}
		>
			<header class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
				<div>
					<h2 class="text-base font-semibold text-slate-900">{title}</h2>
					{#if description}
						<p class="mt-0.5 text-xs text-slate-500">{description}</p>
					{/if}
				</div>
				<button
					type="button"
					class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
					aria-label="Tutup"
					onclick={onclose}
				>
					✕
				</button>
			</header>

			<div class="px-6 py-4">
				{#if children}{@render children()}{/if}
			</div>

			{#if footer}
				<footer class="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
