<script lang="ts">
	import type { Snippet } from 'svelte';

	let { variant = 'slate', children }: { variant?: string; children?: Snippet } = $props();

	const styles: Record<string, string> = {
		slate: 'bg-slate-100 text-slate-700',
		green: 'bg-emerald-100 text-emerald-700',
		amber: 'bg-amber-100 text-amber-700',
		red: 'bg-red-100 text-red-700',
		blue: 'bg-blue-100 text-blue-700',
		purple: 'bg-violet-100 text-violet-700'
	};
</script>

<span
	class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium {styles[
		variant
	] ?? styles.slate}"
>
	{#if children}{@render children()}{/if}
</span>
