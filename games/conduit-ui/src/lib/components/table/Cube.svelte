<script lang="ts">
    import { cubeShape } from '$lib/utils/cubeShape.js'

    // Shaded by colour mixes rather than filters, which cost phones dearly.
    let { size, color }: { size: number; color: string } = $props()
    const shape = $derived(cubeShape(size))
</script>

<polygon class="face" points={shape.top} style:fill="color-mix(in srgb, {color} 60%, white)"
></polygon>
<polygon class="face" points={shape.left} style:fill={color}></polygon>
<polygon class="face" points={shape.right} style:fill="color-mix(in srgb, {color} 62%, black)"
></polygon>
<polygon class="rim" points={shape.outline}></polygon>

<style>
    .face {
        stroke: none;
    }

    .rim {
        fill: none;
        stroke: rgb(0 0 0 / 0.65);
        stroke-width: 1.2;
        stroke-linejoin: round;
    }
</style>
