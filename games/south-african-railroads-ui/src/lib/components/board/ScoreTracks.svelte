<script lang="ts">
    import { ACTION_TRACK_LIMIT } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ACTION_TRACK_CELL,
        ACTION_TRACK_ORIGIN,
        DIVIDEND_TRACK_CELL,
        DIVIDEND_TRACK_ORIGIN
    } from '$lib/utils/boardLayout.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const PER_ROW = 18
    const DIVIDEND_LABELS = ['S', '1', '2', '3', '4', '5', 'F']

    const actionCells = Array.from({ length: ACTION_TRACK_LIMIT + 1 }, (_, value) => ({
        value,
        x: ACTION_TRACK_ORIGIN.x + (value % PER_ROW) * ACTION_TRACK_CELL,
        y: ACTION_TRACK_ORIGIN.y + Math.floor(value / PER_ROW) * ACTION_TRACK_CELL
    }))

    const actionMarker = $derived(
        actionCells[Math.min(gameSession.gameState.actionTrack, ACTION_TRACK_LIMIT)]
    )
    const dividendIndex = $derived(Math.min(gameSession.gameState.dividendsPaid, 6))
</script>

<g class="action-track">
    <text x={ACTION_TRACK_ORIGIN.x} y={ACTION_TRACK_ORIGIN.y - 9} class="heading">Action Track</text>
    <text
        x={ACTION_TRACK_ORIGIN.x + PER_ROW * ACTION_TRACK_CELL}
        y={ACTION_TRACK_ORIGIN.y - 9}
        class="note">dividends are paid once it passes 35</text
    >
    {#each actionCells as cell (cell.value)}
        <rect
            x={cell.x}
            y={cell.y}
            width={ACTION_TRACK_CELL}
            height={ACTION_TRACK_CELL}
            class="cell"
            class:reached={cell.value <= gameSession.gameState.actionTrack}
        />
        <text x={cell.x + ACTION_TRACK_CELL / 2} y={cell.y + 16} class="number">{cell.value}</text>
    {/each}
    <Cube x={actionMarker.x + ACTION_TRACK_CELL / 2} y={actionMarker.y + ACTION_TRACK_CELL / 2 + 1} size={17} />
</g>

<g class="dividend-track">
    <text x={DIVIDEND_TRACK_ORIGIN.x} y={DIVIDEND_TRACK_ORIGIN.y - 12} class="heading">Dividends Paid</text>
    {#each DIVIDEND_LABELS as label, index (label)}
        {@const x = DIVIDEND_TRACK_ORIGIN.x + index * DIVIDEND_TRACK_CELL}
        <rect
            {x}
            y={DIVIDEND_TRACK_ORIGIN.y}
            width={DIVIDEND_TRACK_CELL - 8}
            height="40"
            rx="3"
            class="dividend-cell"
            class:final={label === 'F'}
        />
        <text x={x + (DIVIDEND_TRACK_CELL - 8) / 2} y={DIVIDEND_TRACK_ORIGIN.y + 28} class="dividend-label"
            >{label}</text
        >
        {#if index === dividendIndex}
            <Cube x={x + DIVIDEND_TRACK_CELL - 14} y={DIVIDEND_TRACK_ORIGIN.y + 8} size={15} />
        {/if}
    {/each}
    <text x={DIVIDEND_TRACK_ORIGIN.x} y={DIVIDEND_TRACK_ORIGIN.y + 60} class="note-left"
        >Dividend per share = income ÷ 5, rounded up.</text
    >
    <text x={DIVIDEND_TRACK_ORIGIN.x} y={DIVIDEND_TRACK_ORIGIN.y + 75} class="note-left"
        >Final payoff per share = (income + value) ÷ shares sold, rounded up.</text
    >
</g>

<style>
    .heading {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        fill: #3b2410;
    }

    .note {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
        fill: #6b4a28;
        text-anchor: end;
    }

    .note-left {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11.5px;
        font-style: italic;
        fill: #6b4a28;
    }

    .cell {
        fill: #fbf5e3;
        stroke: #5c3f1f;
        stroke-width: 1;
    }

    .cell.reached {
        fill: #f1dfae;
    }

    .number {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 10.5px;
        fill: #5c3f1f;
        text-anchor: middle;
    }

    .dividend-cell {
        fill: #fbf5e3;
        stroke: #5c3f1f;
        stroke-width: 1.6;
    }

    .dividend-cell.final {
        fill: #f3d58b;
    }

    .dividend-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 22px;
        fill: #3b2410;
        text-anchor: middle;
    }
</style>
