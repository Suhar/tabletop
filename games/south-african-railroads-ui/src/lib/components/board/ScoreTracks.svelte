<script lang="ts">
    import { ACTION_TRACK_LIMIT, ROUNDS } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ACTION_TRACK_CELL, boardLayout } from '$lib/utils/boardLayout.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const layout = $derived(boardLayout(gameSession.gameState.mapId))
    const trackOrigin = $derived(layout.spec.actionTrack)
    const columns = $derived(layout.spec.actionTrackColumns)
    const roundOrigin = $derived(layout.spec.roundIndicator)

    const actionCells = $derived(
        Array.from({ length: ACTION_TRACK_LIMIT + 1 }, (_, value) => ({
            value,
            x: trackOrigin.x + (value % columns) * ACTION_TRACK_CELL,
            y: trackOrigin.y + Math.floor(value / columns) * ACTION_TRACK_CELL
        }))
    )

    const actionMarker = $derived(
        actionCells[Math.min(gameSession.gameState.actionTrack, ACTION_TRACK_LIMIT)]
    )
    const round = $derived(gameSession.gameState.round())
    const finalRound = $derived(gameSession.gameState.isFinalPayoffNext())
</script>

<g class="action-track">
    <text x={trackOrigin.x} y={trackOrigin.y - 9} class="heading">Action Track</text>
    <text
        x={trackOrigin.x + columns * ACTION_TRACK_CELL}
        y={trackOrigin.y + layout.actionTrackRows * ACTION_TRACK_CELL + 14}
        class="note">dividends are paid once it passes {ACTION_TRACK_LIMIT}</text
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
    <text
        x={roundOrigin.x}
        y={roundOrigin.y + 24}
        class="round"
        class:final={finalRound}>{finalRound ? 'Final Round' : `Round ${round} of ${ROUNDS}`}</text
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

    .round.final {
        fill: #b0262e;
    }

    .round {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 28px;
        font-weight: 700;
        fill: #3b2410;
    }
</style>
