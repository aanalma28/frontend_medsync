<script lang="ts">
    /**
     * DashboardSkeletonApoteker — Skeleton loading layout matching Pharmacist Dashboard (Beranda).
     * 
     * Layout structure mirrored:
     *   - Hero banner (dark gradient, amber tones)
     *   - 3-column statistics cards
     *   - Urgent prescription highlight
     *   - 2-column grid: Antrean Resep (left, wider) | Loket + Stok Kritis (right)
     */
    import S from './SkeletonBlock.svelte';
</script>

<!-- HERO BANNER SKELETON (Dark/Amber Theme) -->
<div class="mb-8 rounded-[24px] bg-gradient-to-br from-slate-300 via-stone-200 to-amber-100 p-6 sm:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <div class="flex items-center gap-2 mb-3">
                <S width="0.625rem" height="0.625rem" rounded="rounded-full" />
                <S width="9rem" height="0.625rem" />
            </div>
            <S width="65%" height="2.25rem" rounded="rounded-xl" />
            <S width="55%" height="1rem" />
        </div>
        <div class="rounded-2xl bg-white/30 px-5 py-3 w-40">
            <S width="60%" height="0.625rem" class="mb-2" />
            <S width="80%" height="1.125rem" />
        </div>
    </div>
</div>

<!-- STATISTIK 3-KOLOM -->
<section class="mb-6 grid gap-4 sm:grid-cols-3">
    {#each [{ border: 'border-rose-100' }, { border: 'border-emerald-100' }, { border: 'border-amber-100' }] as item}
        <div class="rounded-2xl border {item.border} bg-white p-5 shadow-sm">
            <S width="55%" height="0.875rem" class="mb-3" />
            <S width="3.5rem" height="2rem" rounded="rounded-lg" />
        </div>
    {/each}
</section>

<!-- MODUL FOKUS UTAMA (Urgent Card) -->
<section class="mb-6 rounded-[24px] border-2 border-slate-200 bg-slate-50 p-6 sm:p-8">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <div class="flex items-center gap-2 mb-2">
                <S width="5rem" height="1.25rem" rounded="rounded" />
                <S width="5rem" height="0.875rem" />
            </div>
            <S width="50%" height="1.75rem" rounded="rounded-xl" />
            <S width="35%" height="0.875rem" />
        </div>
        <div class="rounded-xl bg-white p-4 shadow-sm md:w-1/2 space-y-3">
            <S width="8rem" height="0.625rem" />
            <div class="mt-2 flex flex-wrap gap-2">
                <S width="8rem" height="1.75rem" rounded="rounded-lg" />
                <S width="7rem" height="1.75rem" rounded="rounded-lg" />
            </div>
            <S width="100%" height="2.5rem" rounded="rounded-xl" class="mt-4" />
        </div>
    </div>
</section>

<!-- 2-COLUMN: ANTREAN RESEP + LOKET/STOK -->
<div class="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">

    <!-- KIRI: DAFTAR RESEP -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <S width="12rem" height="1.25rem" class="mb-5 pb-4 border-b border-slate-100" />
        <S width="100%" height="2.75rem" rounded="rounded-xl" class="mb-5" />
        <div class="space-y-4">
            {#each Array(3) as _}
                <div class="flex flex-col gap-4 sm:flex-row sm:justify-between rounded-xl border-l-4 border-l-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div class="space-y-2 flex-1">
                        <div class="flex items-center gap-2">
                            <S width="45%" height="0.875rem" />
                            <S width="4rem" height="1rem" rounded="rounded" />
                        </div>
                        <S width="60%" height="0.625rem" />
                        <div class="flex gap-1 mt-2">
                            <S width="6rem" height="1.25rem" rounded="rounded" />
                            <S width="5rem" height="1.25rem" rounded="rounded" />
                        </div>
                    </div>
                    <div class="flex flex-col justify-center">
                        <S width="5.5rem" height="2rem" rounded="rounded-xl" />
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- KANAN: LOKET + STOK KRITIS -->
    <aside class="space-y-6">
        <!-- Loket Penyerahan Obat -->
        <div class="rounded-[24px] bg-slate-200 p-5 sm:p-6">
            <S width="12rem" height="1.125rem" class="mb-1" />
            <S width="10rem" height="0.625rem" class="mb-4" />
            <div class="space-y-3">
                {#each Array(1) as _}
                    <div class="flex items-center justify-between rounded-xl bg-white/30 p-3">
                        <div class="space-y-1.5 flex-1">
                            <S width="50%" height="0.875rem" />
                            <S width="35%" height="0.625rem" />
                        </div>
                        <S width="4rem" height="1.75rem" rounded="rounded-lg" />
                    </div>
                {/each}
            </div>
        </div>

        <!-- Stok Kritis -->
        <div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <S width="10rem" height="1rem" class="mb-4" />
            <div class="space-y-3">
                {#each Array(1) as _}
                    <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div class="space-y-1.5 flex-1">
                            <S width="50%" height="0.875rem" />
                            <S width="35%" height="0.625rem" />
                        </div>
                        <S width="2rem" height="1.5rem" rounded="rounded" />
                    </div>
                {/each}
            </div>
        </div>
    </aside>
</div>
