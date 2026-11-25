<script lang="ts">
    import { cubeShape } from '$lib/utils/cubeShape.js'

    // One wooden cube in perspective, its top face's back corner at (0, 0). Shading comes from the
    // player's colour, lighter on top and darker on the right, with no filters.
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
