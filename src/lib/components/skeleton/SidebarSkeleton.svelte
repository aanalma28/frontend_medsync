<script lang="ts">
    /**
     * SidebarSkeleton — Skeleton placeholder matching Sidebar.svelte layout.
     * Shown in place of the real sidebar while the profile/auth request loads.
     */
    import S from './SkeletonBlock.svelte';
</script>

<aside class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-100 bg-white px-5 py-6 transition-transform duration-300 ease-in-out -translate-x-full lg:static lg:w-64 lg:translate-x-0 lg:shadow-none">
    <!-- Logo / Branding -->
    <div class="mb-8 px-2 space-y-2">
        <S width="8rem" height="1.5rem" rounded="rounded-lg" />
        <S width="5rem" height="0.625rem" />
    </div>

    <!-- Menu Items -->
    <nav class="flex flex-1 flex-col gap-2">
        {#each Array(4) as _}
            <div class="flex items-center gap-3 rounded-xl px-4 py-3">
                <S width="1.5rem" height="1.5rem" rounded="rounded" />
                <S width="60%" height="0.875rem" />
            </div>
        {/each}
    </nav>

    <!-- Footer / Logout -->
    <div class="mt-auto border-t border-slate-100 pt-4">
        <div class="flex items-center gap-3 rounded-xl px-4 py-3">
            <S width="1.5rem" height="1.5rem" rounded="rounded" />
            <S width="5rem" height="0.875rem" />
        </div>
    </div>
</aside>
