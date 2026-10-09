<script lang="ts">
    import { LEGEND_ORIGIN } from '$lib/utils/mapLabels.js'
    import { polygonPoints } from '$lib/utils/shapes.js'

    const ENTRIES = [
        { label: 'Agricultural Railhead', income: '$1 → $5', shape: 'hex', fill: '#f2b81e' },
        { label: 'Mercantile Center', income: '$2 → $4', shape: 'circle', fill: '#d42a22' },
        { label: 'Railroad Station', income: '$1 → $2', shape: 'square', fill: '#2d58b0' },
        { label: 'Railroad Base', income: '$3 → $6', shape: 'pentagon', fill: '#8a7860' }
    ]
</script>

<g transform="translate({LEGEND_ORIGIN.x} {LEGEND_ORIGIN.y})" class="legend">
    {#each ENTRIES as entry, index (entry.label)}
        <g transform="translate(18 {index * 50 + 18})">
            {#if entry.shape === 'hex'}
                <polygon points={polygonPoints(6, 15)} fill={entry.fill} class="symbol" />
            {:else if entry.shape === 'circle'}
                <circle r="13" fill={entry.fill} class="symbol" />
            {:else if entry.shape === 'square'}
                <rect x="-11.5" y="-11.5" width="23" height="23" rx="2" fill={entry.fill} class="symbol" />
            {:else}
                <polygon points={polygonPoints(5, 17)} fill={entry.fill} class="symbol" />
            {/if}
            <text x="26" y="-2" class="label">{entry.label}</text>
            <text x="26" y="14" class="income">{entry.income} once developed</text>
        </g>
    {/each}
</g>

<style>
    .symbol {
        stroke: #1d140b;
        stroke-width: 1.4;
    }

    .label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #3b2410;
    }

    .income {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11.5px;
        font-style: italic;
        fill: #6b4a28;
    }
</style>
