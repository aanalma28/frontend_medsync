<script lang="ts">
    interface Props {
        role?: 'pasien' | 'dokter' | 'admin';
        activeMenu: string;
        isOpen: boolean;
        onMenuSelect: (menuId: string) => void;
        onClose: () => void;
    }

    let { role = 'pasien', activeMenu, isOpen, onMenuSelect, onClose }: Props = $props();

    // 1. Sekarang config HANYA menyimpan nama ikon berupa string biasa
    const menuConfig = {
        pasien: [
            { id: 'beranda', label: 'Beranda', iconName: 'beranda' },
            { id: 'janji', label: 'Janji Temu', iconName: 'janji' },
            { id: 'resep', label: 'Resep Obat', iconName: 'resep' },
            { id: 'pengaturan', label: 'Pengaturan', iconName: 'pengaturan' }
        ],
        dokter: [
            { id: 'beranda', label: 'Dasbor Dokter', iconName: 'beranda' },
            { id: 'jadwal', label: 'Jadwal Praktik', iconName: 'janji' },
            { id: 'pasien', label: 'Daftar Pasien', iconName: 'users' }
        ],
        admin: [
            { id: 'beranda', label: 'Panel Admin', iconName: 'beranda' },
            { id: 'users', label: 'Direktori & Verifikasi Pasien', iconName: 'users' }
        ]
    };

    let currentMenus = $derived(menuConfig[role] || menuConfig.pasien);

    function handleMenuClick(id: string) {
        onMenuSelect(id);
        onClose(); // Otomatis tutup sidebar di HP
    }
</script>

<!-- 2. Svelte 5 Snippets: Tempat menampung elemen UI murni (bebas XSS) -->
{#snippet renderIcon(name: string)}
    {#if name === 'beranda'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-.46-.46V20.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-7.06l-.46.46a.75.75 0 11-1.06-1.06l8.99-9z" /></svg>
    {:else if name === 'janji'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clip-rule="evenodd" /></svg>
    {:else if name === 'resep'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path fill-rule="evenodd" d="M10.5 3A1.5 1.5 0 009 4.5v1.5H5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h13.5a3 3 0 003-3V9a3 3 0 00-3-3H15V4.5A1.5 1.5 0 0013.5 3h-3zm-1.5 3h6v1.5h-6V6zM9 12a.75.75 0 01.75-.75h1.5v-1.5a.75.75 0 011.5 0v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5A.75.75 0 019 12z" clip-rule="evenodd" /></svg>
    {:else if name === 'pengaturan'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.014-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" /></svg>
    {:else if name === 'users'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" /></svg>
    {/if}
{/snippet}

<!-- Overlay Mobile -->
{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" onclick={onClose}></div>
{/if}

<aside class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sky-100 bg-white px-5 py-6 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 lg:shadow-none {isOpen ? 'translate-x-0' : '-translate-x-full'}">
    
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button onclick={onClose} class="absolute right-5 top-7 text-slate-400 hover:text-sky-700 lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>

    <div class="mb-8 px-2">
        <h2 class="text-2xl font-bold text-sky-800">MedSync<span class="text-sky-500">.</span></h2>
        <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Portal {role}</p>
    </div>

    <nav class="flex flex-1 flex-col gap-2">
        {#each currentMenus as menu (menu.id)}
            <button 
                onclick={() => handleMenuClick(menu.id)}
                class="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all {activeMenu === menu.id ? 'bg-sky-50 text-sky-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}"
            >
                <!-- 3. Memanggil Snippet SVG di sini menggunakan @render -->
                {@render renderIcon(menu.iconName)}
                
                {menu.label}
            </button>
        {/each}
    </nav>

    <div class="mt-auto border-t border-slate-100 pt-4">
        <button class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50">
            <!-- Render ikon "Keluar" secara langsung dan aman -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path fill-rule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clip-rule="evenodd" /></svg>
            Keluar Akun
        </button>
    </div>
</aside>