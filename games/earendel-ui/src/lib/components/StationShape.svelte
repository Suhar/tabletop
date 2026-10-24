<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { stationCoreRadius } from '$lib/utils/stationGeometry.js'

    let {
        center,
        color,
        hub = false,
        linkedAngles = []
    }: { center: Point; color: string; hub?: boolean; linkedAngles?: number[] } = $props()

    // Flat-topped hexes put the six neighbours at 30° plus multiples of 60°.
    const NEIGHBOUR_ANGLES = Array.from(
        { length: 6 },
        (_unused, i) => Math.PI / 6 + (Math.PI / 3) * i
    )

    function angleBetween(a: number, b: number): number {
        return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
    }

    let coreRadius = $derived(stationCoreRadius(hub))

    // A side joined to a neighbouring station by a girder gives up its docking stub.
    let stubs = $derived(
        NEIGHBOUR_ANGLES.filter(
            (angle) => !linkedAngles.some((linked) => angleBetween(angle, linked) < 0.1)
        ).map((angle) => ({
            x: center.x + (coreRadius + 3) * Math.cos(angle),
            y: center.y + (coreRadius + 3) * Math.sin(angle),
            degrees: (angle * 180) / Math.PI
        }))
    )

    function octagon(radius: number): string {
        return Array.from({ length: 8 }, (_unused, i) => {
            const angle = Math.PI / 8 + (Math.PI / 4) * i
            return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`
        }).join(' ')
    }

    const POD_ANGLES = Array.from({ length: 6 }, (_unused, i) => (Math.PI / 3) * i)
</script>

{#each stubs as stub, index (index)}
    <rect
        x={stub.x - 3}
        y={stub.y - 4.5}
        width="6"
        height="9"
        rx="1.5"
        fill={color}
        fill-opacity="0.75"
        transform="rotate({stub.degrees} {stub.x} {stub.y})"
    />
{/each}

{#if hub}
    <g class="hub-ring">
        <circle
            cx={center.x}
            cy={center.y}
            r="26"
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-opacity="0.7"
        />
        {#each POD_ANGLES as angle, index (index)}
            <circle
                cx={center.x + 26 * Math.cos(angle)}
                cy={center.y + 26 * Math.sin(angle)}
                r="5"
                fill={color}
            />
        {/each}
    </g>
{/if}

<polygon points={octagon(coreRadius)} fill={color}></polygon>
{#if hub}
    <circle cx={center.x} cy={center.y} r="6" fill="#fff6d8" fill-opacity="0.9" />
{:else}
    <polygon points={octagon(7)} fill="#0b1222" fill-opacity="0.45" />
{/if}

<style>
    /* Use the `animation` shorthand: Svelte rewrites scoped @keyframes names only there. */
    .hub-ring {
        transform-box: fill-box;
        transform-origin: center;
        animation: hub-turn 30s linear infinite;
    }

    @keyframes hub-turn {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .hub-ring {
            animation: none;
        }
    }
</style>
