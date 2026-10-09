<script lang="ts">
    import {
        SETTLEMENTS,
        SettlementKind,
        incomeLevels,
        railroadDefinition,
        type SettlementDefinition
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { METRO_CELL, METRO_GRIDS } from '$lib/utils/boardLayout.js'
    import {
        BASE_NAMES,
        SETTLEMENT_LABELS,
        metroCaptionBox,
        metroFrameBox,
        settlementIconBox
    } from '$lib/utils/mapLabels.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import { polygonPoints } from '$lib/utils/shapes.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const SYMBOL_FILL: Partial<Record<SettlementKind, string>> = {
        [SettlementKind.AgriculturalRailhead]: '#f2b81e',
        [SettlementKind.RailroadStation]: '#2d58b0',
        [SettlementKind.MercantileCenter]: '#d42a22'
    }

    const developTargets = $derived(
        new Map(gameSession.developTargets.map((target) => [target.settlementId, target.cost]))
    )

    const settlements = $derived(
        SETTLEMENTS.map((place) => {
            const level = gameSession.gameState.developmentLevel(place.id)
            return {
                ...place,
                level,
                income: incomeLevels(place.id)[level],
                cost: developTargets.get(place.id)
            }
        })
    )

    function baseStyle(place: SettlementDefinition) {
        return place.homeOf ? RAILROAD_STYLE[place.homeOf] : RAILROAD_STYLE.CMRC
    }

    function metroCells(place: SettlementDefinition) {
        const grid = METRO_GRIDS[place.id]
        return incomeLevels(place.id).map((value, index) => ({
            value,
            index,
            x: grid.origin.x + (index % grid.columns) * METRO_CELL,
            y: grid.origin.y + Math.floor(index / grid.columns) * METRO_CELL
        }))
    }

    function onKey(event: KeyboardEvent, settlementId: string) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.develop(settlementId)
        }
    }
</script>

<g class="settlement-layer">
    {#each BASE_NAMES as base (base.railroadId)}
        <text x={base.x} y={base.y} class="base-name" fill={RAILROAD_STYLE[base.railroadId].fill}
            >{railroadDefinition(base.railroadId).shortName}</text
        >
    {/each}

    {#each settlements as place (place.id)}
        {@const label = SETTLEMENT_LABELS[place.id]}
        {#if label}
            <text
                x={label.x}
                y={label.y}
                class="name"
                transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}
                >{place.name}</text
            >
        {/if}
    {/each}

    {#each settlements as place (place.id)}
        <g class="settlement" filter="url(#sar-shadow)">
            {#if place.kind === SettlementKind.MetroArea}
                {@const frame = metroFrameBox(place)}
                {@const caption = metroCaptionBox(place)}
                <rect
                    x={caption.x}
                    y={caption.y}
                    width={caption.width}
                    height={caption.height}
                    rx="4"
                    class="metro-caption"
                />
                <text
                    x={caption.x + caption.width / 2}
                    y={caption.y + caption.height / 2 + 4.5}
                    class="metro-name">{place.name}</text
                >
                <rect
                    x={frame.x}
                    y={frame.y}
                    width={frame.width}
                    height={frame.height}
                    rx="4"
                    class="metro-frame"
                />
                {#each metroCells(place) as cell (cell.value)}
                    <rect
                        x={cell.x}
                        y={cell.y}
                        width={METRO_CELL}
                        height={METRO_CELL}
                        class="metro-cell"
                        class:current={cell.index === place.level}
                        class:passed={cell.index < place.level}
                    />
                    <text
                        x={cell.x + METRO_CELL / 2}
                        y={cell.y + METRO_CELL / 2 + 5.5}
                        class="metro-value"
                        class:current={cell.index === place.level}>{cell.value}</text
                    >
                {/each}
                {#if place.level > 0}
                    {@const current = metroCells(place)[place.level]}
                    <Cube x={current.x + METRO_CELL - 4} y={current.y + 5} size={12} />
                {/if}
            {:else}
                <g transform="translate({place.x} {place.y})">
                    {#if place.kind === SettlementKind.RailroadStation}
                        <rect x="-13.5" y="-13.5" width="27" height="27" rx="2" fill={SYMBOL_FILL[place.kind]} class="symbol" />
                    {:else if place.kind === SettlementKind.AgriculturalRailhead}
                        <polygon points={polygonPoints(6, 18.5)} fill={SYMBOL_FILL[place.kind]} class="symbol" />
                    {:else if place.kind === SettlementKind.MercantileCenter}
                        <circle r="16.3" fill={SYMBOL_FILL[place.kind]} class="symbol" />
                    {:else}
                        <polygon
                            points={polygonPoints(5, 23)}
                            fill={baseStyle(place).fill}
                            class="symbol"
                        />
                    {/if}
                    <text
                        y="5"
                        class="income"
                        class:dark={place.kind === SettlementKind.AgriculturalRailhead}>{place.income}</text
                    >
                    {#if place.level > 0}
                        <Cube x={12} y={-13} size={13} />
                    {/if}
                </g>
            {/if}
        </g>
    {/each}

    {#each settlements as place (place.id)}
        {#if place.cost !== undefined}
            {@const bounds =
                place.kind === SettlementKind.MetroArea
                    ? settlementIconBox(place)
                    : { x: place.x - 22, y: place.y - 22, width: 44, height: 44 }}
            <g
                class="develop-target"
                role="button"
                tabindex="0"
                aria-label="Develop {place.name}{place.cost > 0 ? ` for $${place.cost}` : ''}"
                onclick={() => gameSession.develop(place.id)}
                onkeydown={(event) => onKey(event, place.id)}
            >
                <rect
                    x={bounds.x - 5}
                    y={bounds.y - 5}
                    width={bounds.width + 10}
                    height={bounds.height + 10}
                    rx="9"
                    class="ring"
                />
            </g>
        {/if}
    {/each}
</g>

<style>
    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        font-style: italic;
        fill: #2c1d0e;
        paint-order: stroke;
        stroke: rgba(246, 238, 215, 0.85);
        stroke-width: 3px;
        pointer-events: none;
    }

    .base-name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 27px;
        font-weight: 700;
        paint-order: stroke;
        stroke: #f6eed7;
        stroke-width: 4px;
        pointer-events: none;
    }

    .symbol {
        stroke: #1d140b;
        stroke-width: 1.6;
    }

    .income {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #ffffff;
        text-anchor: middle;
        pointer-events: none;
    }

    .income.dark {
        fill: #2a1a08;
    }

    .metro-frame {
        fill: #3b2a17;
    }

    .metro-caption {
        fill: #f7efd9;
        stroke: #3b2a17;
        stroke-width: 2;
    }

    .metro-name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12.5px;
        font-style: italic;
        font-weight: 700;
        fill: #2c1d0e;
        text-anchor: middle;
    }

    .metro-cell {
        fill: #fdf8ea;
        stroke: #3b2a17;
        stroke-width: 1.2;
    }

    .metro-cell.passed {
        fill: #e2d6b8;
    }

    .metro-cell.current {
        fill: #ffe08a;
    }

    .metro-value {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #7a6748;
        text-anchor: middle;
        pointer-events: none;
    }

    .metro-value.current {
        fill: #2a1a08;
    }

    .develop-target {
        cursor: pointer;
        outline: none;
    }

    .ring {
        fill: rgba(255, 230, 140, 0.18);
        stroke: #c8961a;
        stroke-width: 3;
        stroke-dasharray: 6 4;
        animation: sar-ring 1.4s linear infinite;
    }

    .develop-target:hover .ring,
    .develop-target:focus-visible .ring {
        fill: rgba(255, 230, 140, 0.5);
    }



    @keyframes sar-ring {
        to {
            stroke-dashoffset: -20;
        }
    }
</style>
