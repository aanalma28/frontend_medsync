<script lang="ts">
    import S from './SkeletonBlock.svelte';
</script>

<!-- HERO BANNER SKELETON -->
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

<!-- STATISTIK 4-KOLOM (Admin biasanya melihat lebih banyak summary) -->
<section class="mb-6 grid gap-4 sm:grid-cols-4">
    {#each Array(4) as _}
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center gap-3">
                <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
                <S width="55%" height="0.875rem" />
            </div>
            <S width="4rem" height="2rem" rounded="rounded-lg" class="mt-3" />
        </div>
    {/each}
</section>

<!-- 2-COLUMN: DATA MANAGEMENT -->
<div class="grid gap-6 xl:grid-cols-2">
    <!-- KIRI: TABEL SKELETON -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="space-y-2">
                <S width="12rem" height="1.25rem" />
                <S width="14rem" height="0.75rem" />
            </div>
        </div>
        <div class="space-y-4">
            {#each Array(5) as _}
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div class="flex gap-3 items-center w-full">
                        <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
                        <div class="space-y-1.5 flex-1">
                            <S width="40%" height="0.875rem" />
                            <S width="20%" height="0.625rem" />
                        </div>
                        <S width="5rem" height="1.5rem" rounded="rounded-lg" />
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- KANAN: FORM SKELETON -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="space-y-2">
                <S width="10rem" height="1.25rem" />
                <S width="16rem" height="0.75rem" />
            </div>
        </div>
        <div class="space-y-5">
            {#each Array(4) as _}
                <div>
                    <S width="30%" height="0.875rem" class="mb-2" />
                    <S width="100%" height="2.75rem" rounded="rounded-xl" />
                </div>
            {/each}
            <S width="100%" height="3rem" rounded="rounded-xl" class="mt-6" />
        </div>
    </section>
</div>
