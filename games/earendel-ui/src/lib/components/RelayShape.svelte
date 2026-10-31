<script lang="ts">
    import type { Point } from '@tabletop/common'

    let { center, color }: { center: Point; color: string } = $props()

    // Signal arcs either side of a diamond core.
    const ARCS = [
        { radius: 11, opacity: 0.95 },
        { radius: 17, opacity: 0.6 }
    ]

    function arc(radius: number, side: 1 | -1): string {
        const spread = Math.PI / 4
        const start = { x: side * radius * Math.cos(spread), y: -radius * Math.sin(spread) }
        const end = { x: side * radius * Math.cos(spread), y: radius * Math.sin(spread) }
        return `M${start.x},${start.y} A${radius},${radius} 0 0 ${side === 1 ? 1 : 0} ${end.x},${end.y}`
    }
</script>

<g transform="translate({center.x} {center.y})">
    <polygon points="0,-8 7,0 0,8 -7,0" fill={color} />
    <circle r="2.4" fill="#0b1222" fill-opacity="0.5" />
    {#each ARCS as ring (ring.radius)}
        {#each [1, -1] as const as side (side)}
            <path
                d={arc(ring.radius, side)}
                fill="none"
                stroke={color}
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-opacity={ring.opacity}
            />
        {/each}
    {/each}
</g>
