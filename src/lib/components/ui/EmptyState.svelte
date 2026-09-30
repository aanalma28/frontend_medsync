<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon = '📭',
		title = 'Belum ada data',
		description = '',
		action
	}: { icon?: string; title?: string; description?: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center justify-center px-6 py-16 text-center">
	<p class="text-4xl">{icon}</p>
	<h3 class="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
	{#if description}
		<p class="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
	{/if}
	{#if action}
		<div class="mt-4">
			{@render action()}
		</div>
	{/if}
</div>
