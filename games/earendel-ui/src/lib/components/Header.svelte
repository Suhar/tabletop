<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const activePlayerId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div
    class="flex h-[40px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-white uppercase tracking-[0.08em] text-[16px] max-sm:text-[13px]"
>
    <div class="inline-flex gap-x-1">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if activePlayerId}
            <PlayerName playerId={activePlayerId} possessive={true} capitalization="uppercase" />
            <span>turn</span>
        {/if}
    </div>

    {#if gameSession.canUndo}
        <button
            type="button"
            class="rounded-md px-3 py-1 max-sm:px-2 max-sm:py-0.5 text-xs font-semibold uppercase border-2 border-white/70 hover:bg-white/15"
            onclick={() => gameSession.undo()}
        >
            Undo
        </button>
    {/if}
</div>
