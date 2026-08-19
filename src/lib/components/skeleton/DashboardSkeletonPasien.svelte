<script lang="ts">
    /**
     * DashboardSkeletonPasien — Skeleton loading layout matching Patient Dashboard (Beranda).
     * 
     * Layout structure mirrored:
     *   - Hero banner
     *   - Smart alerts area
     *   - 2-column grid: Jadwal Mendatang (left) | Pengobatan + Catatan Dokter (right)
     */
    import S from './SkeletonBlock.svelte';
</script>

<!-- HERO BANNER SKELETON -->
<div class="mb-6 rounded-[24px] bg-gradient-to-r from-slate-200 to-slate-100 p-6 sm:p-8">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <S width="70%" height="2.25rem" rounded="rounded-xl" />
            <S width="55%" height="1rem" />
        </div>
        <div class="rounded-2xl bg-white/40 px-5 py-3 w-40">
            <S width="60%" height="0.625rem" class="mb-2" />
            <S width="80%" height="1.25rem" />
        </div>
    </div>
</div>

<!-- SMART ALERTS SKELETON -->
<div class="mb-8 space-y-3">
    <div class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4">
        <div class="flex items-center gap-3 flex-1">
            <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
            <div class="flex-1 space-y-2">
                <S width="40%" height="0.875rem" />
                <S width="65%" height="0.75rem" />
            </div>
        </div>
        <S width="5rem" height="2rem" rounded="rounded-xl" />
    </div>
</div>

<!-- 2-COLUMN GRID: JADWAL + OBAT/CATATAN -->
<div class="grid gap-6 lg:grid-cols-2">
    <!-- KIRI: KARTU JADWAL -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between">
            <S width="10rem" height="1.25rem" />
            <S width="6rem" height="0.875rem" />
        </div>
        <div class="space-y-4">
            {#each Array(2) as _}
                <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <S width="55%" height="1rem" />
                        <S width="3rem" height="1.25rem" rounded="rounded" />
                    </div>
                    <S width="40%" height="0.875rem" />
                    <div class="flex items-center gap-4">
                        <S width="6rem" height="0.75rem" />
                        <S width="5rem" height="0.75rem" />
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- KANAN: PENGOBATAN + CATATAN DOKTER -->
    <aside class="space-y-6">
        <!-- Pengobatan Saat Ini -->
        <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <S width="12rem" height="1.25rem" class="mb-4" />
            <div class="space-y-3">
                {#each Array(2) as _}
                    <div class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <S width="45%" height="0.875rem" />
                        <S width="6rem" height="1.25rem" rounded="rounded-lg" />
                    </div>
                {/each}
            </div>
        </div>

        <!-- Catatan Dokter -->
        <div class="rounded-[24px] bg-slate-200 p-6">
            <S width="14rem" height="1.25rem" class="mb-4" />
            <div class="rounded-xl bg-slate-300/40 p-4 space-y-3">
                <div class="flex items-center justify-between mb-2">
                    <S width="50%" height="0.875rem" />
                    <S width="4rem" height="0.625rem" />
                </div>
                <S width="90%" height="0.75rem" />
                <S width="70%" height="0.75rem" />
                <S width="8rem" height="0.625rem" class="mt-3" />
            </div>
        </div>
    </aside>
</div>
