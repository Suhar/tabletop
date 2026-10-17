<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)
    const note = $derived(boardLayout(map.id).automaticDevelopment)
    const order = $derived(
        map.definition.automaticDevelopment.map((settlementId) => map.settlement(settlementId).name)
    )
</script>

{#if note}
    <g transform="translate({note.x} {note.y})" aria-label="Automatic Metro Development order">
        <text x={note.width / 2} y="16" class="title">Automatic Metro Development</text>
        <text x={note.width / 2} y="35" class="order">{order.join(' · ')}</text>
        <text x={note.width / 2} y="50" class="body">once one is full, the next</text>
    </g>
{/if}

<style>
    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        font-weight: 700;
        fill: #3b2410;
        text-anchor: middle;
    }

    .order {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        fill: #3b2410;
        text-anchor: middle;
    }

    .body {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11.5px;
        font-style: italic;
        fill: #6b4a28;
        text-anchor: middle;
    }
</style>
