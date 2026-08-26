<script lang="ts">
	import { page } from '$app/stores';
	import ErrorState from '$lib/components/ErrorState.svelte';
</script>

<!-- Memanggil komponen utama dan melemparkan status serta pesan dari server store -->
<ErrorState status={$page.status} message={$page.error?.message} />
