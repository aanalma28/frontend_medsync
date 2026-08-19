<script lang="ts">
    /**
     * SkeletonBlock — Atomic reusable skeleton element with shimmer animation.
     * Use this as a building block for composing skeleton layouts.
     * 
     * Props:
     *   width   — CSS width (default: '100%')
     *   height  — CSS height (default: '1rem')
     *   rounded — CSS border-radius class (default: 'rounded-lg')
     *   class   — Extra CSS classes to merge
     */
    interface Props {
        width?: string;
        height?: string;
        rounded?: string;
        class?: string;
    }

    let { width = '100%', height = '1rem', rounded = 'rounded-lg', class: extraClass = '' }: Props = $props();
</script>

<div
    class="skeleton-shimmer {rounded} {extraClass}"
    style="width: {width}; height: {height};"
    aria-hidden="true"
></div>

<style>
    .skeleton-shimmer {
        background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
</style>
