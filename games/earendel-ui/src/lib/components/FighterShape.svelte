<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { DART, type FighterSilhouette } from '$lib/utils/fighterShapes.js'

    let {
        center,
        color,
        level,
        torpedo = false,
        silhouette = DART
    }: {
        center: Point
        color: string
        level: number
        // A fighter placed as a Gamma Torpedo: one ship, red-tipped, until it strikes.
        torpedo?: boolean
        // The player color's own ship (utils/fighterShapes.ts).
        silhouette?: FighterSilhouette
    } = $props()

    const WARHEAD = '#ff6b5e'

    const FORMATIONS: Record<number, { x: number; y: number }[]> = {
        1: [{ x: 0, y: -4 }],
        2: [
            { x: -10, y: -2 },
            { x: 10, y: -8 }
        ],
        3: [
            { x: 0, y: -14 },
            { x: -15, y: 4 },
            { x: 15, y: 4 }
        ]
    }

    let darts = $derived(torpedo ? FORMATIONS[1] : FORMATIONS[Math.min(Math.max(level, 1), 3)])
    let scale = $derived(torpedo ? 1.6 : level <= 1 ? 1.3 : 1.05)
</script>

{#each darts as dart, index (index)}
    <g transform="translate({center.x + dart.x} {center.y + dart.y}) scale({scale})">
        {#if silhouette.trail}
            <path
                d={silhouette.trail}
                fill="none"
                stroke={color}
                stroke-width="2.4"
                stroke-linejoin="round"
                stroke-linecap="round"
            />
        {:else}
            <path d="M-2,8 L0,20 L2,8 Z" fill={color} fill-opacity="0.45" />
            <path d="M-1,8 L0,14 L1,8 Z" fill="#fff3cc" fill-opacity="0.8" />
        {/if}
        <path d={silhouette.body} fill={color} />
        {#each silhouette.windows ?? [] as window, pane (pane)}
            <path d={window} fill="#fff3cc" fill-opacity="0.85" />
        {/each}
        {#if torpedo}
            <path d="M0,-13 L3,0 L-3,0 Z" fill={WARHEAD} />
            <circle r="12" fill="none" stroke={WARHEAD} stroke-width="1.5" stroke-opacity="0.7" />
        {/if}
    </g>
{/each}
