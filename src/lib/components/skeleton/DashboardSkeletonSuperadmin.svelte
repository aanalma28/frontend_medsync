<script lang="ts">
    import S from './SkeletonBlock.svelte';
</script>

<!-- HERO BANNER SKELETON -->
<div class="mb-8 rounded-[24px] bg-slate-900 p-6 sm:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div class="space-y-3 flex-1">
            <div class="flex items-center gap-2 mb-3">
                <S width="0.625rem" height="0.625rem" rounded="rounded-full" />
                <S width="8rem" height="0.625rem" />
            </div>
            <S width="65%" height="2.25rem" rounded="rounded-xl" />
            <S width="50%" height="1rem" />
        </div>
        <div class="rounded-2xl bg-white/10 px-5 py-3 w-44">
            <S width="60%" height="0.625rem" class="mb-2" />
            <S width="80%" height="1.125rem" />
        </div>
    </div>
</div>

<!-- STATISTIK 4-KOLOM (Superadmin Analytics) -->
<section class="mb-6 grid gap-4 sm:grid-cols-4">
    {#each Array(4) as _}
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="flex items-center gap-3">
                <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
                <S width="55%" height="0.875rem" />
            </div>
            <S width="6rem" height="2rem" rounded="rounded-lg" class="mt-3" />
            <S width="4rem" height="0.75rem" rounded="rounded-md" class="mt-2" />
        </div>
    {/each}
</section>

<!-- 2-COLUMN: CHARTS & OVERVIEW -->
<div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
    <!-- KIRI: CHART SKELETON -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="space-y-2">
                <S width="14rem" height="1.25rem" />
                <S width="18rem" height="0.75rem" />
            </div>
            <S width="6rem" height="1.5rem" rounded="rounded-lg" />
        </div>
        <div class="h-64 flex items-end justify-between gap-4 mt-8">
            {#each Array(7) as _, i}
                <div class="w-full bg-slate-100 rounded-t-lg" style="height: {30 + (i * 10) % 60}%"></div>
            {/each}
        </div>
    </section>

    <!-- KANAN: LIST OVERVIEW SKELETON -->
    <section class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="space-y-2">
                <S width="12rem" height="1.25rem" />
                <S width="15rem" height="0.75rem" />
            </div>
        </div>
        <div class="space-y-4">
            {#each Array(4) as _}
                <div class="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div class="flex gap-3 items-center w-full">
                        <S width="2.5rem" height="2.5rem" rounded="rounded-full" />
                        <div class="space-y-1.5 flex-1">
                            <S width="60%" height="0.875rem" />
                            <S width="30%" height="0.625rem" />
                        </div>
                        <S width="3rem" height="1rem" rounded="rounded-lg" />
                    </div>
                </div>
            {/each}
        </div>
    </section>
</div>
