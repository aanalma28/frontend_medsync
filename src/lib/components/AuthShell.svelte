<script lang="ts">  
    import { LoginData, RegisterData } from '$lib/types';
    
    interface Props {
        title: string;
        subtitle: string;
        submitLabel: string;
        footerText: string;
        footerHref: string;
        footerLinkLabel: string;
        isRegister?: boolean;
    }

    let {
        title,
        subtitle,
        submitLabel,
        footerText,
        footerHref,
        footerLinkLabel,
        isRegister = false
    }: Props = $props();

    // 1. State Management
    let selectedRole = $state('pasien');
    let userInputs = $state({
        fullName: '',
        patientId: '',
        doctorId: '',
        staffCode: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
        rememberMe: false
    });

    let isSubmitting = $state(false);
    let backendError = $state('');
    let isPasswordFocused = $state(false); // Untuk trigger dropdown aturan password

    // 2. Real-time Validation Logic (Menggunakan $derived Svelte 5)
    let isRoleValid = $derived(['pasien', 'dokter', 'admin'].includes(selectedRole));
    let isNameValid = $derived(userInputs.fullName.length >= 3 && userInputs.fullName.length <= 100);
    
    // Menentukan user_code yang aktif berdasarkan role
    let activeUserCode = $derived(
        selectedRole === 'pasien' ? userInputs.patientId : 
        selectedRole === 'dokter' ? userInputs.doctorId : 
        userInputs.staffCode
    );
    let isCodeValid = $derived(activeUserCode.length >= 3 && activeUserCode.length <= 50);
    
    let isEmailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInputs.email) && userInputs.email.length <= 100);
    
    // Pecahan validasi password
    let isPwdLength = $derived(userInputs.password.length >= 8 && userInputs.password.length <= 128);
    let isPwdUpper = $derived(/[A-Z]/.test(userInputs.password));
    let isPwdLower = $derived(/[a-z]/.test(userInputs.password));
    let isPwdNum = $derived(/\d/.test(userInputs.password));
    let isPasswordValid = $derived(isPwdLength && isPwdUpper && isPwdLower && isPwdNum);

    let isConfirmValid = $derived(userInputs.confirmPassword === userInputs.password && userInputs.password.length > 0);
    let isTermsValid = $derived(userInputs.termsAccepted === true);

    // Kunci utama: Apakah form valid untuk di-submit?
    let isFormValid = $derived(isRoleValid && isNameValid && isCodeValid && isEmailValid && isPasswordValid && isConfirmValid && isTermsValid);

    function roleHint(role: string) {
        if (role === 'dokter') return 'Akses panel dokter, jadwal praktik, dan riwayat pasien.';
        if (role === 'admin') return 'Akses pengelolaan pengguna, klinik, dan pengaturan sistem.';
        return 'Akses janji temu, hasil pemeriksaan, dan informasi kesehatan Anda.';
    }

    // 3. Modifikasi fungsi handleSubmit untuk menangkap event dan error
    async function handleSubmit(event: Event) {
        event.preventDefault(); // Mencegah reload halaman bawaan HTML form
        
        backendError = '';
        isSubmitting = true;

        try {
            if (isRegister) {
                // Memastikan tidak submit jika frontend belum valid
                if (!isFormValid) {
                    isSubmitting = false;
                    return; 
                }

                RegisterData.set({
                    role: selectedRole,
                    name: userInputs.fullName,
                    user_code: activeUserCode,
                    email: userInputs.email,
                    password: userInputs.password,
                    confirm_password: userInputs.confirmPassword,
                    accepted_terms: userInputs.termsAccepted
                });

                const response = await fetch(import.meta.env.VITE_API_URL + '/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...$RegisterData })
                });

                if (response.ok) {
                    alert('Registrasi berhasil! Silakan masuk.');
                    window.location.href = '/login';
                } else {
                    // Handling Error Backend 400 (Bad Request dari class-validator)
                    const errorData = await response.json();
                    if (Array.isArray(errorData.message)) {
                        backendError = errorData.message.join(' • '); // Gabungkan array jadi string
                    } else {
                        backendError = errorData.message || 'Terjadi kesalahan validasi server.';
                    }
                }
            } else {
                LoginData.set({
                    role: selectedRole,
                    email: userInputs.email,
                    password: userInputs.password,
                    remember_me: userInputs.rememberMe
                });

                const response = await fetch(import.meta.env.VITE_API_URL + '/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...$LoginData })
                });

                if(response.ok){
                    alert('Login berhasil! Mengalihkan ke dashboard.');					
                    window.location.href = selectedRole == "pasien" ? '/pasien/dashboard' : selectedRole == "dokter" ? 'doctor/dashboard' : selectedRole == "apoteker" ? 'apoteker/dashboard' : '/login'
                } else {
                    const errorData = await response.json();
                    backendError = errorData.message || 'Email atau kata sandi salah.';
                }
            }
        } catch (error) {
            backendError = 'Gagal terhubung ke server. Pastikan backend menyala.';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>{title} | MedSync</title>
</svelte:head>

<div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#eef7ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div class="mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden rounded-[32px] border border-sky-100 bg-white/80 shadow-[0_30px_80px_-30px_rgba(2,132,199,0.45)] backdrop-blur xl:min-h-[760px] xl:flex-row">
        
        <!-- Bagian Kiri (Hero) Tetap Sama -->
        <section class="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-700 px-8 py-10 text-white sm:px-10 lg:w-[46%] lg:px-12 lg:py-12">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_30%)]"></div>
            <div class="relative z-10">
                <div class="flex items-center gap-3">
                    <div class="rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 24 24" fill="none">
                            <path d="M12 3c2.8 0 5.2 1.7 6.3 4.2l.4 1.1c.4 1 .5 2.1.2 3.1-.3 1.1-1.1 2.1-2.2 2.8l-1.5.8c-.4.2-.6.6-.6 1.1v.6c0 .6-.4 1-1 1h-3.5c-.6 0-1-.4-1-1v-.6c0-.5-.2-.9-.6-1.1l-1.5-.8c-1.1-.7-1.9-1.7-2.2-2.8-.3-1-.2-2.1.2-3.1l.4-1.1C6.8 4.7 9.2 3 12 3Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9.2 14.6h5.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </div>
                <div>
                    <p class="text-sm font-semibold uppercase tracking-[0.28em] text-sky-100">MedSync Care</p>
                    <p class="text-sm text-sky-100/80">Patient access portal</p>
                </div>
            </div>

            <div class="mt-10 max-w-md space-y-5">
                <div class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-sky-50 backdrop-blur">
                    <span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    Secure medical access • 24/7 support
                </div>
                <h1 class="text-3xl font-semibold leading-tight sm:text-4xl">Akses layanan kesehatan anda dengan lebih aman dan cepat.</h1>
                <p class="text-base leading-7 text-sky-50/90">
                    Kelola janji temu, lihat hasil pemeriksaan, dan jaga komunikasi dengan tim medis rumah sakit melalui portal terintegrasi.
                </p>
            </div>
        </div>

        <div class="relative z-10 mt-8 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-sky-50 backdrop-blur sm:mt-10 lg:mt-0">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    <path d="M4 8h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
            </div>
            <p>Terhubung ke sistem rekam medis rumah sakit anda.</p>
        </div>
        </section>

        <!-- Bagian Kanan (Form) -->
        <section class="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-8 lg:px-10">
            <div class="w-full max-w-md rounded-[28px] border border-slate-200 bg-slate-50/80 p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.3)] sm:p-8">
                
                <!-- Tampilan Banner Error dari Backend -->
                {#if backendError}
                    <div class="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 shadow-sm transition-all">
                        <div class="flex gap-3">
                            <span class="text-lg">⚠️</span>
                            <div>
                                <strong class="block font-semibold">Terdapat Kesalahan:</strong>
                                <span class="block mt-1">{backendError}</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="flex items-center gap-3">
                    <div class="rounded-2xl bg-sky-100 p-3 text-sky-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none">
                            <path d="M12 3.5 4 7v5c0 4.1 2.7 7.8 8 8.5 5.3-.7 8-4.4 8-8.5V7l-8-3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="m9.5 12 1.7 1.7 3.3-3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-sky-700">Masuk ke akun anda</p>
                        <p class="text-sm text-slate-500">Portal rumah sakit terpercaya</p>
                    </div>
                </div>

                <h2 class="mt-6 text-2xl font-semibold text-slate-900">{title}</h2>
                <p class="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>

                <!-- Menambahkan onsubmit pada tag form -->
                <form class="mt-8 space-y-4" onsubmit={handleSubmit}>
                    <div class="rounded-2xl border border-sky-100 bg-sky-50/80 p-3">
                        <label class="block text-sm font-medium text-slate-700">
                            <span class="mb-2 block">Pilih role akun</span>
                            <select bind:value={selectedRole} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                                <option value="pasien">Pasien</option>
                                <option value="dokter">Dokter</option>
                                <option value="admin">Admin / Staff</option>
                            </select>
                        </label>
                        <p class="mt-2 text-xs leading-5 text-slate-600">{roleHint(selectedRole)}</p>
                    </div>

                    {#if isRegister}
                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="block text-sm font-medium text-slate-700 relative">
                                <span class="mb-2 block">Nama lengkap</span>
                                <input bind:value={userInputs.fullName} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Dr. Aulia Rahman" />
                                {#if userInputs.fullName.length > 0}
                                    <span class="absolute right-3 top-10 text-sm">{isNameValid ? '✅' : '❌'}</span>
                                {/if}
                            </label>

                            <!-- Kode Pasien / Dokter / Staff -->
                            <label class="block text-sm font-medium text-slate-700 relative">
                                <span class="mb-2 block">
                                    {selectedRole === 'pasien' ? 'Nomor pasien' : selectedRole === 'dokter' ? 'ID dokter' : 'Kode staff'}
                                </span>
                                {#if selectedRole === 'pasien'}
                                    <input bind:value={userInputs.patientId} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="BP-2054" />
                                {:else if selectedRole === 'dokter'}
                                    <input bind:value={userInputs.doctorId} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="DOC-001" />
                                {:else}
                                    <input bind:value={userInputs.staffCode} class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="ADM-001" />
                                {/if}
                                {#if activeUserCode.length > 0}
                                    <span class="absolute right-3 top-10 text-sm">{isCodeValid ? '✅' : '❌'}</span>
                                {/if}
                            </label>
                        </div>
                    {/if}

                    <label class="block text-sm font-medium text-slate-700 relative">
                        <span class="mb-2 block">Email</span>
                        <input bind:value={userInputs.email} type="email" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="nama@rumahsakitsatu.com" />
                        {#if isRegister && userInputs.email.length > 0}
                            <span class="absolute right-3 top-10 text-sm">{isEmailValid ? '✅' : '❌'}</span>
                        {/if}
                    </label>

                    <label class="block text-sm font-medium text-slate-700 relative">
                        <span class="mb-2 block">Kata sandi</span>
                        <input 
                            bind:value={userInputs.password} 
                            type="password" 
                            onfocus={() => isPasswordFocused = true}
                            onblur={() => isPasswordFocused = false}
                            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" 
                            placeholder="Minimal 8 karakter" 
                        />
                        {#if isRegister && userInputs.password.length > 0}
                            <span class="absolute right-3 top-10 text-sm">{isPasswordValid ? '✅' : '❌'}</span>
                        {/if}
                    </label>

                    <!-- Dropdown Password Checklist (Hanya muncul saat fokus di register) -->
                    {#if isRegister && isPasswordFocused}
                        <div class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm transition-all duration-300">
                            <p class="mb-1.5 font-medium text-slate-700">Syarat kata sandi:</p>
                            <ul class="space-y-1">
                                <li class="flex items-center gap-1.5 {isPwdLength ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isPwdLength ? '✅' : '❌'}</span> Minimal 8 karakter
                                </li>
                                <li class="flex items-center gap-1.5 {isPwdUpper ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isPwdUpper ? '✅' : '❌'}</span> Minimal 1 huruf kapital
                                </li>
                                <li class="flex items-center gap-1.5 {isPwdLower ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isPwdLower ? '✅' : '❌'}</span> Minimal 1 huruf kecil
                                </li>
                                <li class="flex items-center gap-1.5 {isPwdNum ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isPwdNum ? '✅' : '❌'}</span> Minimal 1 angka
                                </li>
                            </ul>
                        </div>
                    {/if}

                    {#if isRegister}
                        <label class="block text-sm font-medium text-slate-700 relative">
                            <span class="mb-2 block">Konfirmasi kata sandi</span>
                            <input bind:value={userInputs.confirmPassword} type="password" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Ulangi kata sandi" />
                            {#if userInputs.confirmPassword.length > 0}
                                <span class="absolute right-3 top-10 text-sm">{isConfirmValid ? '✅' : '❌'}</span>
                            {/if}
                        </label>

                        <!-- Box Validasi Utama (Reactive Checklist) -->
                        <div class="mt-3 rounded-2xl border {isFormValid ? 'border-green-300 bg-green-50/50' : 'border-slate-200 bg-white/60'} p-4 text-sm transition-all">
                            <p class="mb-2 font-medium text-slate-700">Status Validasi Formulir</p>
                            <ul class="space-y-1.5 text-xs">
                                <li class="flex items-center gap-2 {isNameValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isNameValid ? '✅' : '❌'}</span> Nama terisi dengan benar (3-100 karakter)
                                </li>
                                <li class="flex items-center gap-2 {isCodeValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isCodeValid ? '✅' : '❌'}</span> Nomor/ID terisi dengan benar (3-50 karakter)
                                </li>
                                <li class="flex items-center gap-2 {isEmailValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isEmailValid ? '✅' : '❌'}</span> Format email valid
                                </li>
                                <li class="flex items-center gap-2 {isPasswordValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isPasswordValid ? '✅' : '❌'}</span> Syarat kombinasi kata sandi terpenuhi
                                </li>
                                <li class="flex items-center gap-2 {isConfirmValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isConfirmValid ? '✅' : '❌'}</span> Konfirmasi sandi cocok
                                </li>
                                <li class="flex items-center gap-2 {isTermsValid ? 'text-green-600' : 'text-slate-500'}">
                                    <span>{isTermsValid ? '✅' : '❌'}</span> Syarat penggunaan disetujui
                                </li>
                            </ul>
                        </div>
                    {/if}

                    <div class="flex items-center justify-between text-sm text-slate-500">
                        <label class="flex items-center gap-2 cursor-pointer">
                            {#if isRegister}
                                <input type="checkbox" bind:checked={userInputs.termsAccepted} class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer" />
                                <span class="{!isTermsValid && isRegister ? 'text-red-500' : 'text-slate-600'}">Saya menyetujui syarat penggunaan</span>
                            {:else}
                                <input type="checkbox" bind:checked={userInputs.rememberMe} class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                                <span>Ingat saya</span>
                            {/if}                           
                        </label>
                        {#if !isRegister}
                            <a href='/reset' rel="external" class="font-medium text-sky-700 hover:text-sky-800">Lupa kata sandi?</a>
                        {/if}
                    </div>

                    <!-- Tombol di-disable jika form tidak valid (hanya mode register) atau sedang loading -->
                    <button 
                        type="submit" 
                        disabled={isRegister ? (!isFormValid || isSubmitting) : isSubmitting}
                        class="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Memproses...' : submitLabel}
                    </button>
                </form>

                <div class="mt-6 text-center text-sm text-slate-600">
                    {footerText}
                    <a href={footerHref} rel="external" class="ml-1 font-semibold text-sky-700 transition hover:text-sky-800">{footerLinkLabel}</a>
                </div>
            </div>
        </section>
    </div>
</div>