<script lang="ts">
	import AuthShell from '$lib/components/AuthShell.svelte';
</script>

<AuthShell
	title="Buat akun pasien"
	subtitle="Daftarkan diri Anda untuk mengakses informasi rumah sakit, janji temu, dan hasil pemeriksaan."
	submitLabel="Daftar akun"
	footerText="Sudah punya akun?"
	footerHref="/login"
	footerLinkLabel="Masuk di sini"
	isRegister={true}
/>
