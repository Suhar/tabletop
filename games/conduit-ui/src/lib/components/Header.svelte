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

    /* Lit up, with a green status light. */
    .tag {
        display: flex;
        flex-shrink: 0;
        white-space: nowrap;
        align-items: center;
        gap: 4px;
        font-family: var(--conduit-display);
        font-size: 18px;
        letter-spacing: 0.06em;
        color: #bff0ff;
        text-shadow:
            0 0 6px var(--conduit-live),
            0 0 16px var(--conduit-glow);
    }

    .tag::before {
        content: '';
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        margin-right: 4px;
        border-radius: 50%;
        background: #7dffb0;
        box-shadow: 0 0 6px 2px #3dff8c;
    }

    .buttons {
        display: flex;
        gap: 8px;
        min-width: 0;
    }

    .short {
        display: none;
    }

    /* The mono, thickened, like the action buttons. */
    .button {
        white-space: nowrap;
        padding: 4px 14px;
        border-radius: 2px;
        font-family: var(--conduit-readout);
        -webkit-text-stroke: 0.4px currentColor;
        font-size: 14px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #cfefff;
        background: #081a33;
        box-shadow: inset 0 0 0 1px var(--conduit-accent);
    }

    .button:hover {
        background: #0b2a4f;
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
            font-size: 14px;
            letter-spacing: 0.02em;
        }

        .tag::before {
            width: 8px;
            height: 8px;
            margin-right: 2px;
        }

        .button {
            padding: 2px 7px;
            font-size: 12px;
            letter-spacing: 0.02em;
        }

        .long {
            display: none;
        }

        .short {
            display: inline;
        }
    }
</style>
