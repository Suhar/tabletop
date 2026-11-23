<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { constellationFor } from '$lib/utils/constellations.js'

    // The back of a ship card: the owner's constellation over their color's dark ground, one
    // star lit in their color.
    let { color, tint }: { color: Color; tint: string } = $props()
    let constellation = $derived(constellationFor(color))
    let lit = $derived(constellation.stars[constellation.lit])
</script>

<svg aria-hidden="true" class="block h-full w-full" viewBox="0 0 66 96">
    <rect width="66" height="96" rx="8" style="fill: color-mix(in srgb, {tint} 55%, #000)" />
    <rect
        x="3"
        y="3"
        width="60"
        height="90"
        rx="5.5"
        fill="none"
        stroke={tint}
        stroke-opacity="0.35"
        stroke-width="0.75"
    />
    <circle
        cx="33"
        cy="48"
        r="28"
        fill="none"
        stroke={tint}
        stroke-opacity="0.28"
        stroke-width="0.5"
        stroke-dasharray="1 2.5"
    />
    {#each constellation.lines as [from, to], index (index)}
        <line
            x1={constellation.stars[from][0]}
            y1={constellation.stars[from][1]}
            x2={constellation.stars[to][0]}
            y2={constellation.stars[to][1]}
            stroke="#fff"
            stroke-opacity="0.3"
            stroke-width="0.45"
        />
    {/each}
    {#each constellation.stars as [x, y, r], index (index)}
        {#if index !== constellation.lit}
            <circle cx={x} cy={y} {r} fill="#fff" />
        {/if}
    {/each}
    <circle cx={lit[0]} cy={lit[1]} r={lit[2] + 3} fill={tint} fill-opacity="0.22" />
    <circle cx={lit[0]} cy={lit[1]} r={lit[2] + 1.4} fill={tint} fill-opacity="0.45" />
    <circle cx={lit[0]} cy={lit[1]} r={lit[2] + 0.3} fill={tint} />
    <circle cx={lit[0]} cy={lit[1]} r="0.5" fill="#fff" />
</svg>
