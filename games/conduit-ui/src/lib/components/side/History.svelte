<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { historyItems, type HistoryEntry } from '$lib/utils/historyEntries.js'

    const gameSession = getGameSession()
    const name = (playerId: string) => gameSession.getPlayerName(playerId)
    const items = $derived(historyItems(gameSession.actions, name).toReversed())

    async function jumpTo(entry: HistoryEntry) {
        await gameSession.history.goToActionIndex(entry.lastIndex)
    }
</script>

<div class="history">
    {#each items as item (item.key)}
        {#if item.kind === 'divider'}
            <h4 class="divider">{item.label}</h4>
        {:else}
            <button
                type="button"
                class="entry"
                title="Show the table at this point"
                onclick={() => jumpTo(item)}
            >
                <h5>{item.title}</h5>
                {#each item.lines as line, index (index)}
                    <p>{line}</p>
                {/each}
            </button>
        {/if}
    {/each}
</div>

<style>
    /* The mono, thickened, like the player readouts. */
    .history {
        font-family: var(--conduit-readout);
        -webkit-text-stroke: 0.3px currentColor;
        display: grid;
        gap: 6px;
        max-height: 100%;
        overflow-y: auto;
    }

    .divider {
        margin-top: 6px;
        font-size: 13px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--conduit-accent);
    }

    .entry {
        display: block;
        width: 100%;
        text-align: left;
        padding: 6px 10px;
        border-radius: 8px;
        background: var(--conduit-panel);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
        cursor: pointer;
    }

    .entry:hover {
        background: var(--conduit-panel-raised);
    }

    h5 {
        font-size: 15px;
        -webkit-text-stroke: 0.5px currentColor;
    }

    p {
        font-size: 14px;
        color: var(--conduit-muted);
    }
</style>
