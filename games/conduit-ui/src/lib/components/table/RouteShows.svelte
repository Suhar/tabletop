<script lang="ts">
    import type { OffsetCoordinates } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CellSize, cellOrigin, type BoardBounds } from '$lib/utils/boardLayout.js'
    import { centredTextShift } from '$lib/utils/tableLayout.js'
    import type { RouteShow } from '$lib/animators/routeAnimator.svelte.js'
    import RouteFlow from './RouteFlow.svelte'

    // The revenue animation's drawing for each paying station, hidden until the route animator
    // reveals it: the search's segments and the cells it reached by distance, the destinations it
    // found, tied routes, the chosen route, captions and payouts. The animator only tweens these
    // elements' attributes; they go when the payout's state is shown.
    let { bounds }: { bounds: BoardBounds } = $props()

    const gameSession = getGameSession()
    const shows = $derived(gameSession.routeAnimator.shows)
    const mounted = $derived(gameSession.routeAnimator.mounted)
    const detailed = $derived(gameSession.routeAnimator.detailed)
    const half = CellSize / 2
    const CaptionFont = 19

    function centre(cell: OffsetCoordinates) {
        const origin = cellOrigin(cell, bounds)
        return { x: origin.x + half, y: origin.y + half }
    }

    function points(cells: OffsetCoordinates[]): string {
        return cells
            .map((cell) => {
                const point = centre(cell)
                return `${point.x},${point.y}`
            })
            .join(' ')
    }

    function pillWidth(text: string): number {
        return Math.round(text.length * CaptionFont * 0.56 + 22)
    }
</script>

{#snippet pill(text: string, attribute: string, id: string, at: { x: number; y: number })}
    <g transform="translate({at.x} {at.y})">
        <g {...{ [attribute]: id }} opacity="0">
            <rect
                class="caption"
                x={-pillWidth(text) / 2}
                y="-17"
                width={pillWidth(text)}
                height="34"
                rx="17"
            ></rect>
            <text class="caption-text" text-anchor="middle" dy={centredTextShift(CaptionFont)}
                >{text}</text
            >
        </g>
    </g>
{/snippet}

{#each shows as show, index (show.key)}
    {#if mounted.has(index)}
        {@render drawing(show, `${index}`)}
    {/if}
{/each}

{#snippet drawing(show: RouteShow, id: string)}
    {@const home = centre(show.station)}
    <!-- Captions sit above the station, or below it on the board's top row. -->
    {@const above = {
        x: home.x,
        y: show.station.row > bounds.minRow ? home.y - half - 4 : home.y + half + 4
    }}
    <g class="show" data-show={id} visibility="hidden" style:--owner={show.color}>
        {#each detailed ? show.layers : [] as layer, depth (depth)}
            {#each layer as step (`${step.cell.col},${step.cell.row}`)}
                {@const origin = cellOrigin(step.cell, bounds)}
                <rect
                    class="tint"
                    data-show-tint="{id}-{depth}"
                    data-show-searched={id}
                    x={origin.x + 5}
                    y={origin.y + 5}
                    width={CellSize - 10}
                    height={CellSize - 10}
                    rx="10"
                    opacity="0"
                ></rect>
            {/each}
        {/each}
        {#each detailed ? show.layers : [] as layer, depth (depth)}
            {#each layer as step (`${step.cell.col},${step.cell.row}`)}
                {@const a = centre(step.from)}
                {@const b = centre(step.cell)}
                <line
                    class="segment"
                    data-show-segment="{id}-{depth}"
                    data-show-searched={id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    pathLength="1"
                    stroke-dasharray="1 1"
                    stroke-dashoffset="1"
                    opacity="1"
                ></line>
            {/each}
        {/each}
        {#each show.candidates as candidate, which (which)}
            <polyline
                class="candidate"
                data-show-candidate={id}
                points={points(candidate)}
                opacity="0"
            ></polyline>
        {/each}
        {#if show.route.length > 1}
            <!-- The route draws in, then becomes the glowing, flowing route as it pays. The glow is
                 shown, never faded: a fade over its blur and moving dashes would repaint them all
                 every frame. -->
            <g data-show-glow={id} visibility="hidden">
                <RouteFlow
                    id="conduit-show-glow-{show.key}"
                    line={show.route.map(centre)}
                    color={show.color}
                    flowing={detailed}
                />
            </g>
            <polyline
                class="route-draw"
                data-show-route={id}
                points={points(show.route)}
                pathLength="1"
                stroke-dasharray="1 1"
                stroke-dashoffset="1"
                opacity="1"
            ></polyline>
        {/if}
        <g transform="translate({home.x} {home.y}) rotate({show.emblem.rotation})">
            <g data-show-ring={id} opacity="0">
                <polygon class="station-ring" points={show.emblem.points}></polygon>
            </g>
        </g>
        {#each show.ends as end (`${end.cell.col},${end.cell.row}`)}
            {@const point = centre(end.cell)}
            <g transform="translate({point.x} {point.y}) rotate({end.emblem.rotation})">
                <g data-show-end={id} opacity="0">
                    <polygon class="end" points={end.emblem.points}></polygon>
                </g>
            </g>
        {/each}
        {@render pill(show.caption, 'data-show-caption', id, above)}
        {#if show.tie}
            {@render pill(show.tie, 'data-show-tie', id, above)}
        {/if}
        {@render pill(show.verdict, 'data-show-verdict', id, above)}
        {#if show.amount > 0}
            <g transform="translate({home.x} {home.y})">
                <g data-show-pay={id} opacity="0">
                    <rect class="pay" x="-28" y="-16" width="56" height="32" rx="16"></rect>
                    <text class="pay-text" text-anchor="middle" dy={centredTextShift(19)}
                        >+${show.amount}</text
                    >
                </g>
            </g>
        {/if}
        {#each show.tolls as toll (`${toll.cell.col},${toll.cell.row}`)}
            {@const point = centre(toll.cell)}
            <g transform="translate({point.x} {point.y})">
                <g data-show-pay={id} opacity="0">
                    <rect
                        class="toll"
                        x="-24"
                        y="-14"
                        width="48"
                        height="28"
                        rx="14"
                        style:fill={toll.color}
                    ></rect>
                    <text class="toll-text" text-anchor="middle" dy={centredTextShift(16)}
                        >+${toll.amount}</text
                    >
                </g>
            </g>
        {/each}
    </g>
{/snippet}

<style>
    .show {
        pointer-events: none;
    }

    .tint {
        fill: var(--owner);
        fill-opacity: 0.22;
        stroke: var(--owner);
        stroke-opacity: 0.6;
        stroke-width: 2;
    }

    .segment {
        stroke: var(--owner);
        stroke-width: 6;
        stroke-linecap: round;
    }

    .candidate {
        fill: none;
        stroke: #fff;
        stroke-width: 5;
        stroke-dasharray: 10 8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .route-draw {
        fill: none;
        stroke: var(--owner);
        stroke-width: 8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .station-ring,
    .end {
        fill: none;
        stroke-width: 4.5;
        stroke-linejoin: round;
    }

    .station-ring {
        stroke: var(--owner);
    }

    .end {
        stroke: #f5c542;
    }

    .caption {
        fill: #10161f;
        stroke: var(--owner);
        stroke-width: 2;
    }

    .caption-text {
        font-size: 19px;
        font-weight: 700;
        fill: #e8eef6;
    }

    .pay {
        fill: #f5c542;
        stroke: #1b1505;
        stroke-width: 1.5;
    }

    .pay-text {
        font-size: 19px;
        font-weight: 800;
        fill: #1b1505;
    }

    .toll {
        stroke: #1b1505;
        stroke-width: 1.5;
    }

    .toll-text {
        font-size: 16px;
        font-weight: 800;
        fill: #fff;
        stroke: #000;
        stroke-width: 3px;
        paint-order: stroke;
    }
</style>
