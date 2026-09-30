<script lang="ts">
	let { rows = 5, cols = 4 }: { rows?: number; cols?: number } = $props();

	const rowList = $derived(Array.from({ length: rows }));
	const colList = $derived(Array.from({ length: cols }));
</script>

<div class="divide-y divide-slate-100">
	{#each rowList as _, r (r)}
		<div
			class="grid items-center gap-4 px-4 py-3.5"
			style="grid-template-columns: repeat({cols}, minmax(0, 1fr));"
		>
			{#each colList as _, c (c)}
				<div class="h-3.5 animate-pulse rounded bg-slate-100"></div>
			{/each}
		</div>
	{/each}
</div>
