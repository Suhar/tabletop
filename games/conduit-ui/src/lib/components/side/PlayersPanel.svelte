<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerPanel from './PlayerPanel.svelte'

    const gameSession = getGameSession()

    const seats = $derived.by(() => {
        const order = gameSession.gameState.turnManager.turnOrder
        const myIndex = gameSession.primaryGame.hotseat
            ? -1
            : order.indexOf(gameSession.myPlayer?.id ?? '')
        const start = Math.max(myIndex, 0)
        return [...order.slice(start), ...order.slice(0, start)]
    })
</script>

<div class="panels">
    {#each seats as playerId (playerId)}
        <PlayerPanel {playerId} />
    {/each}
</div>

<style>
    .panels {
        display: grid;
        gap: 8px;
    }
</style>
