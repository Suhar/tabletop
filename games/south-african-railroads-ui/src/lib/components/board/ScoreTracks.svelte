<script lang="ts">
    import { ACTION_TRACK_LIMIT, DIVIDENDS_BEFORE_FINAL } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ACTION_TRACK_CELL,
        ACTION_TRACK_ORIGIN,
        ROUND_INDICATOR_ORIGIN
    } from '$lib/utils/boardLayout.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const PER_ROW = 18

    const actionCells = Array.from({ length: ACTION_TRACK_LIMIT + 1 }, (_, value) => ({
        value,
        x: ACTION_TRACK_ORIGIN.x + (value % PER_ROW) * ACTION_TRACK_CELL,
        y: ACTION_TRACK_ORIGIN.y + Math.floor(value / PER_ROW) * ACTION_TRACK_CELL
    }))

    const actionMarker = $derived(
        actionCells[Math.min(gameSession.gameState.actionTrack, ACTION_TRACK_LIMIT)]
    )
    const round = $derived(Math.min(gameSession.gameState.dividendsPaid, DIVIDENDS_BEFORE_FINAL) + 1)
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
    <Cube
        x={actionMarker.x + ACTION_TRACK_CELL / 2}
        y={actionMarker.y + ACTION_TRACK_CELL / 2 + 1}
        size={22}
    />
</g>

<g class="round-indicator">
    <text x={ROUND_INDICATOR_ORIGIN.x} y={ROUND_INDICATOR_ORIGIN.y + 24} class="round">Round {round}</text>
    <text x={ROUND_INDICATOR_ORIGIN.x} y={ROUND_INDICATOR_ORIGIN.y + 60} class="note-left"
        >Dividend per share = income ÷ 5, rounded up.</text
    >
    <text x={ROUND_INDICATOR_ORIGIN.x} y={ROUND_INDICATOR_ORIGIN.y + 75} class="note-left"
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

    .round {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 28px;
        font-weight: 700;
        fill: #3b2410;
    }
</style>
