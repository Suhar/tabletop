<script lang="ts">
    import { Rounds } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { compact = false }: { compact?: boolean } = $props()

    const gameSession = getGameSession()
    const round = $derived(gameSession.gameState.round)
</script>

{#if round > 0}
    <div class="round" class:compact title="Round {round} of {Rounds}">
        <span class="label">Round</span><span class="count">{round}/{Rounds}</span>
    </div>
{/if}

<style>
    /* A small LCD readout, like the cash. */
    .round {
        display: flex;
        align-items: baseline;
        gap: 0.6em;
        flex-shrink: 0;
        white-space: nowrap;
        padding: 2px 8px;
        border-radius: 2px;
        font-size: 15px;
        color: var(--conduit-lcd-ink);
        background: var(--conduit-lcd);
        box-shadow: inset 0 0 0 1px var(--conduit-lcd-line);
        text-shadow: 0 0 6px rgb(61 255 140 / 0.5);
    }

    .label {
        font-family: var(--conduit-readout);
        -webkit-text-stroke: 0.4px currentColor;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    /* OCR-A digits, so the 5 can't pass for an S. */
    .count {
        font-family: var(--conduit-text);
        -webkit-text-stroke: 0.5px currentColor;
        letter-spacing: 0.04em;
    }

    .compact {
        padding: 1px 5px;
        font-size: 12px;
    }

    .compact .label {
        letter-spacing: 0.02em;
    }
</style>
