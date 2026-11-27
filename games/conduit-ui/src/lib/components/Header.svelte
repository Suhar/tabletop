<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const turnPlayerId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div class="header">
    <div class="tag">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName playerId={turnPlayerId} possessive={true} /> turn
        {/if}
    </div>
    <div class="buttons">
        <button
            type="button"
            class="button"
            title="How revenue shows each route: one station at a time with its search, or all at once"
            onclick={() =>
                gameSession.routePace.set(
                    gameSession.routePace.current === 'steps' ? 'quick' : 'steps'
                )}
            >Routes: {#if gameSession.routePace.current === 'steps'}<span class="long"
                    >Step by step</span
                ><span class="short">Steps</span>{:else}Quick{/if}</button
        >
        {#if gameSession.canUndo}
            <button type="button" class="button" onclick={() => gameSession.undo()}>Undo</button>
        {/if}
        <button
            type="button"
            class="button rules"
            class:open={gameSession.rulesOpen}
            aria-expanded={gameSession.rulesOpen}
            onclick={() => gameSession.toggleRules()}>Rules</button
        >
    </div>
</div>

<style>
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 44px;
        padding: 0 12px;
    }

    .tag {
        display: flex;
        flex-shrink: 0;
        white-space: nowrap;
        align-items: center;
        gap: 4px;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .buttons {
        display: flex;
        gap: 8px;
        min-width: 0;
    }

    .short {
        display: none;
    }

    .button {
        white-space: nowrap;
        padding: 4px 14px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--conduit-ink);
        background: var(--conduit-panel-raised);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .button:hover {
        background: var(--conduit-line);
    }

    .rules.open {
        color: var(--conduit-accent-ink);
        background: var(--conduit-accent);
    }

    .button:focus-visible {
        outline: 2px solid var(--conduit-live);
        outline-offset: 2px;
    }

    @media (max-width: 639px) {
        .header {
            height: 36px;
            padding: 0 8px;
        }

        .tag {
            font-size: 15px;
        }

        .button {
            padding: 2px 10px;
            font-size: 13px;
        }

        .long {
            display: none;
        }

        .short {
            display: inline;
        }
    }
</style>
