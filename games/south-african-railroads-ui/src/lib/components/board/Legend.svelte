<script lang="ts">
    import { LEGEND_ORIGIN } from '$lib/utils/mapLabels.js'
    import { polygonPoints } from '$lib/utils/shapes.js'

    const ENTRIES = [
        { name: ['Agricultural', 'Railhead'], base: '$1', developed: '$5', shape: 'hex', fill: '#f2b81e' },
        { name: ['Mercantile', 'Center'], base: '$2', developed: '$4', shape: 'circle', fill: '#d42a22' },
        { name: ['Railroad', 'Station'], base: '$1', developed: '$2', shape: 'square', fill: '#2d58b0' },
        { name: ['Railroad', 'Base'], base: '$3', developed: '$6', shape: 'pentagon', fill: '#8a7860' }
    ]

    const BASE_X = 131
    const DEVELOPED_X = 188
    const ROW_PITCH = 34
    const FIRST_ROW_Y = 40
</script>

<g transform="translate({LEGEND_ORIGIN.x} {LEGEND_ORIGIN.y})" class="legend">
    <text x={BASE_X} y="12" class="heading">Base</text>
    <text x={DEVELOPED_X} y="12" class="heading">Developed</text>
    <line x1="0" y1="20" x2="224" y2="20" class="rule" />
    {#each ENTRIES as entry, index (entry.name.join(' '))}
        <g transform="translate(0 {FIRST_ROW_Y + index * ROW_PITCH})">
            <g transform="translate(14 0)">
                {#if entry.shape === 'hex'}
                    <polygon points={polygonPoints(6, 13)} fill={entry.fill} class="symbol" />
                {:else if entry.shape === 'circle'}
                    <circle r="11" fill={entry.fill} class="symbol" />
                {:else if entry.shape === 'square'}
                    <rect x="-9.5" y="-9.5" width="19" height="19" rx="2" fill={entry.fill} class="symbol" />
                {:else}
                    <polygon points={polygonPoints(5, 14)} fill={entry.fill} class="symbol" />
                {/if}
            </g>
            <text x="34" y="-3" class="name">{entry.name[0]}</text>
            <text x="34" y="11" class="name">{entry.name[1]}</text>
            <text x={BASE_X} y="5" class="amount">{entry.base}</text>
            <text x={DEVELOPED_X} y="5" class="amount">{entry.developed}</text>
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
