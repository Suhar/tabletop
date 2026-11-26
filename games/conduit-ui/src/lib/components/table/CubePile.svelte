<script lang="ts">
    import { cubeShape, pileOffsets, PileCubeSize } from '$lib/utils/cubeShape.js'
    import { centredTextShift } from '$lib/utils/tableLayout.js'
    import Cube from './Cube.svelte'

    // Each cube has its own wrapper for the table animator to lift or drop.
    let { key, count, color }: { key: string; count: number; color: string } = $props()

    const shape = cubeShape(PileCubeSize)
    const origin = { x: 4 + PileCubeSize / 2, y: 4 + shape.rise }
    const offsets = $derived(pileOffsets(count, PileCubeSize))
</script>

<g class="pile" transform="translate({origin.x} {origin.y})" aria-label="{count} cubes">
    {#each offsets as offset, index (index)}
        <g transform="translate({offset.x} {offset.y})">
            <g data-cube="{key}-{index}">
                <Cube size={PileCubeSize} {color} />
            </g>
        </g>
    {/each}
    {#if count > 4}
        <text class="more" x={2 * shape.across.x + 6} y={shape.height / 2} dy={centredTextShift(13)}
            >×{count}</text
        >
    {/if}
</g>

<style>
    .pile {
        pointer-events: none;
    }

    .more {
        font-size: 13px;
        font-weight: 800;
        fill: #fff;
        stroke: #000;
        stroke-width: 3px;
        paint-order: stroke;
    }
</style>
