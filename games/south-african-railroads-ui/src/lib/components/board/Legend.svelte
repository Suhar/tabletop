<script lang="ts">
    import { SettlementKind, type PointSettlementKind } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { polygonPoints } from '$lib/utils/shapes.js'

    const gameSession = getGameSession()

    type Entry = { kind: PointSettlementKind; name: [string, string]; fill: string }

    const ENTRIES: Entry[] = [
        {
            kind: SettlementKind.AgriculturalRailhead,
            name: ['Agricultural', 'Railhead'],
            fill: '#f2b81e'
        },
        { kind: SettlementKind.MercantileCenter, name: ['Mercantile', 'Center'], fill: '#d42a22' },
        { kind: SettlementKind.RailroadStation, name: ['Railroad', 'Station'], fill: '#2d58b0' },
        { kind: SettlementKind.RailroadBase, name: ['Railroad', 'Base'], fill: '#8a7860' }
    ]

    const BASE_X = 131
    const DEVELOPED_X = 188
    const ROW_PITCH = 34
    const FIRST_ROW_Y = 40

    const origin = $derived(boardLayout(gameSession.gameState.mapId).spec.legend)
    const incomes = $derived(gameSession.gameState.map.definition.settlementIncome)
</script>

<g transform="translate({origin.x} {origin.y})" class="legend">
    <text x={BASE_X} y="12" class="heading">Base</text>
    <text x={DEVELOPED_X} y="12" class="heading">Developed</text>
    <line x1="0" y1="20" x2="224" y2="20" class="rule" />
    {#each ENTRIES as entry, index (entry.kind)}
        {@const levels = incomes[entry.kind]}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW_PITCH})">
            <g transform="translate(14 0)">
                {#if entry.kind === SettlementKind.AgriculturalRailhead}
                    <polygon points={polygonPoints(6, 13)} fill={entry.fill} class="symbol" />
                {:else if entry.kind === SettlementKind.MercantileCenter}
                    <circle r="11" fill={entry.fill} class="symbol" />
                {:else if entry.kind === SettlementKind.RailroadStation}
                    <rect
                        x="-9.5"
                        y="-9.5"
                        width="19"
                        height="19"
                        rx="2"
                        fill={entry.fill}
                        class="symbol"
                    />
                {:else}
                    <polygon points={polygonPoints(5, 14)} fill={entry.fill} class="symbol" />
                {/if}
            </g>
            <text x="34" y="-3" class="name">{entry.name[0]}</text>
            <text x="34" y="11" class="name">{entry.name[1]}</text>
            <text x={BASE_X} y="5" class="amount">${levels[0]}</text>
            <text x={DEVELOPED_X} y="5" class="amount">${levels[levels.length - 1]}</text>
        </g>
    {/each}
</g>

<style>
    .symbol {
        stroke: #1d140b;
        stroke-width: 1.4;
    }

    .heading {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
        fill: #3b2410;
    }

    .rule {
        stroke: #6b4a28;
        stroke-width: 1;
    }

    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #3b2410;
    }

    .amount {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        text-anchor: middle;
        fill: #3b2410;
    }
</style>
