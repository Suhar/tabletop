<script lang="ts">
    import type { Point } from '@tabletop/common'

    // Moving dashes repaint their whole route every frame, so only a route shown alone
    // flows; on a 3x phone four flowing routes cost about 130 MB more. The dashes sit above
    // the blur, not under it.
    let {
        id,
        line,
        color,
        flowing = true
    }: { id: string; line: Point[]; color: string; flowing?: boolean } = $props()

    const Width = 8
    const GlowReach = 16
    const Dash = 14
    const Gap = 12
    const Speed = 34

    // Dash offsets move toward a line's start, so the line runs from the destination back.
    const points = $derived(
        line
            .toReversed()
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
    )
    const region = $derived.by(() => {
        const xs = line.map((point) => point.x)
        const ys = line.map((point) => point.y)
        const x = Math.min(...xs) - GlowReach
        const y = Math.min(...ys) - GlowReach
        return {
            x,
            y,
            width: Math.max(...xs) + GlowReach - x,
            height: Math.max(...ys) + GlowReach - y
        }
    })
</script>

<filter
    {id}
    filterUnits="userSpaceOnUse"
    x={region.x}
    y={region.y}
    width={region.width}
    height={region.height}
>
    <feGaussianBlur stdDeviation="4.5"></feGaussianBlur>
</filter>
<g class="route-flow" style:--route={color}>
    <polyline class="glow" {points} stroke-width={Width + 6} filter="url(#{id})"></polyline>
    <polyline class="base" {points} stroke-width={Width}></polyline>
    <polyline
        class="flow"
        class:still={!flowing}
        {points}
        stroke-width={Width - 2}
        stroke-dasharray="{Dash} {Gap}"
        style:--flow-period="{Dash + Gap}px"
        style:--flow-seconds="{(Dash + Gap) / Speed}s"
    ></polyline>
</g>

<style>
    .route-flow {
        pointer-events: none;
    }

    polyline {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .glow {
        stroke: var(--route);
        opacity: 0.9;
    }

    .base {
        stroke: var(--route);
        opacity: 0.45;
    }

    .flow {
        stroke: color-mix(in srgb, var(--route) 45%, white);
        animation: flow var(--flow-seconds) linear infinite;
    }

    .flow.still {
        animation: none;
    }

    @keyframes flow {
        to {
            stroke-dashoffset: var(--flow-period);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .flow {
            animation: none;
        }
    }
</style>
