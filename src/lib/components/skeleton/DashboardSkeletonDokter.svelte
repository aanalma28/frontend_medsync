<script lang="ts">
    /**
     * DashboardSkeletonDokter — Skeleton loading layout matching Doctor Dashboard (Beranda).
     * 
     * Layout structure mirrored:
     *   - Hero banner (dark gradient)
     *   - 3-column statistics cards
     *   - Highlight: Pasien Saat Ini (dark card)
     *   - 2-column grid: Form Resep (left) | Antrean + Struk Digital (right)
     */
    import S from './SkeletonBlock.svelte';
</script>

<!-- HERO BANNER SKELETON (Dark Theme) -->
<div class="mb-8 rounded-[24px] bg-gradient-to-br from-slate-300 to-slate-200 p-6 sm:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <div class="flex items-center gap-2 mb-3">
                <S width="0.625rem" height="0.625rem" rounded="rounded-full" />
                <S width="8rem" height="0.625rem" />
            </div>
            <S width="65%" height="2.25rem" rounded="rounded-xl" />
            <S width="50%" height="1rem" />
        </div>
        <div class="rounded-2xl bg-white/30 px-5 py-3 w-44">
            <S width="60%" height="0.625rem" class="mb-2" />
            <S width="80%" height="1.125rem" />
        </div>
    </div>
</div>

<!-- STATISTIK 3-KOLOM -->
<section class="mb-6 grid gap-4 sm:grid-cols-3">
    {#each Array(3) as _}
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center gap-3">
                <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
                <S width="55%" height="0.875rem" />
            </div>
            <S width="4rem" height="2rem" rounded="rounded-lg" class="mt-3" />
        </div>
    {/each}
</section>

<!-- HIGHLIGHT: PASIEN SAAT INI -->
<section class="mb-6 overflow-hidden rounded-[24px] bg-slate-200 p-6 lg:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <div class="flex items-center gap-3 mb-3">
                <S width="0.75rem" height="0.75rem" rounded="rounded-full" />
                <S width="8rem" height="0.625rem" />
            </div>
            <S width="60%" height="1.875rem" rounded="rounded-xl" />
            <S width="40%" height="1rem" />
        </div>
        <div class="rounded-2xl bg-white/30 p-4 md:w-1/3 space-y-3">
            <S width="50%" height="0.625rem" />
            <S width="80%" height="1rem" />
            <S width="100%" height="2.5rem" rounded="rounded-xl" class="mt-4" />
        </div>
    </div>
</section>

<!-- 2-COLUMN: FORM RESEP + ANTREAN/STRUK -->
<div class="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">

    <!-- KIRI: FORM RESEP -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="space-y-2">
                <S width="10rem" height="1.25rem" />
                <S width="14rem" height="0.75rem" />
            </div>
        </div>
        <div class="space-y-5">
            <!-- Diagnosa -->
            <div>
                <S width="6rem" height="0.75rem" class="mb-2" />
                <S width="100%" height="2.75rem" rounded="rounded-xl" />
            </div>
            <!-- Katalog Obat -->
            <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
                <S width="10rem" height="0.75rem" class="mb-2" />
                <S width="100%" height="2.75rem" rounded="rounded-xl" />
                <div class="space-y-2 mt-4">
                    {#each Array(3) as _}
                        <div class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                            <div class="space-y-1.5 flex-1">
                                <S width="55%" height="0.875rem" />
                                <S width="40%" height="0.625rem" />
                            </div>
                            <S width="5rem" height="1.75rem" rounded="rounded-lg" />
                        </div>
                    {/each}
                </div>
            </div>
            <S width="100%" height="3rem" rounded="rounded-xl" />
        </div>
    </section>

    <!-- KANAN: ANTREAN + STRUK -->
    <aside class="space-y-6">
        <!-- Antrean Berikutnya -->
        <div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <S width="10rem" height="1.125rem" class="mb-4" />
            <div class="space-y-3">
                {#each Array(2) as _}
                    <div class="flex items-center justify-between rounded-xl border-l-4 border-l-slate-200 bg-slate-50 p-3 shadow-sm">
                        <div class="space-y-1.5 flex-1">
                            <S width="50%" height="0.875rem" />
                            <S width="70%" height="0.625rem" />
                        </div>
                        <S width="4rem" height="1.75rem" rounded="rounded-lg" />
                    </div>
                {/each}
            </div>
        </div>

        <!-- Struk Digital -->
        <div class="rounded-[24px] bg-slate-200 p-5 sm:p-6">
            <div class="mb-4 flex items-center justify-between pb-4">
                <div class="space-y-2">
                    <S width="7rem" height="1.125rem" />
                    <S width="10rem" height="0.625rem" />
                </div>
            </div>
            <div class="rounded-xl border-2 border-dashed border-slate-300 p-8">
                <S width="70%" height="0.875rem" class="mx-auto" />
            </div>
        </div>
    </aside>
</div>
