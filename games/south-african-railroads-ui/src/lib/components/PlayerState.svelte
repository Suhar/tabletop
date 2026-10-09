<script lang="ts">
    import { RAILROADS, type HydratedSarPlayerState } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let { playerState }: { playerState: HydratedSarPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const lines = $derived(
        RAILROADS.map((railroad) => {
            const shares = gameSession.gameState.sharesHeld(railroad.id, playerId)
            const each = gameSession.gameState.nextDividendPerShare(railroad.id)
            return {
                railroad,
                style: RAILROAD_STYLE[railroad.id],
                shares,
                each,
                amount: shares * each,
                controls: gameSession.gameState.controls(railroad.id, playerId)
            }
        }).filter((line) => line.shares > 0)
    )
    const finalPayoffNext = $derived(gameSession.gameState.isFinalPayoffNext())
    const dividend = $derived(gameSession.gameState.nextDividend(playerId))
    const projected = $derived(gameSession.gameState.projectedFinalCash(playerId))
</script>

<div class="ticket" class:acting style:--player={color} style:--player-text={textColor}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="cash" title="Cash in hand">${playerState.cash}</span>
    </div>
    <div class="kind">SHAREHOLDER · RETURN</div>
    {#each lines as line (line.railroad.id)}
        <div
            class="line"
            title="{line.railroad.shortName}: ${line.each} a share{line.controls
                ? ' · controls the railroad'
                : ''}"
        >
            <span class="certs">
                {#each Array.from({ length: line.shares }, (_, index) => index) as share (share)}
                    <span
                        class="cert"
                        style:--rr={line.style.fill}
                        style:--rr-text={line.style.text}>{line.railroad.shortName}</span
                    >
                {/each}
                {#if line.controls}<span class="control" aria-label="controls">★</span>{/if}
            </span>
            <span class="leader"></span>
            <span class="amount">${line.amount}</span>
        </div>
    {:else}
        <div class="none">No shares yet</div>
    {/each}
    <div
        class="total"
        title="What this player's shares would pay if {finalPayoffNext
            ? 'the final payoff'
            : 'dividends'} were paid now"
    >
        <span>{finalPayoffNext ? 'FINAL PAYOFF DUE' : 'DIVIDEND DUE'}</span>
        <span>${dividend}</span>
    </div>
    <div class="fine-print" title="Cash plus every share's final payoff if the game ended now">
        Worth at final payoff ${projected}
    </div>
</div>

<style>
    .ticket {
        position: relative;
        overflow: hidden;
        border: 3px solid #f3e7c4;
        border-radius: 5px;
        background: #f3e7c4;
        color: #3b2410;
        font-family: 'Courier Prime', 'Courier New', monospace;
        box-shadow: 0 2px 4px rgba(40, 24, 8, 0.3);
    }

    .ticket.acting {
        border-color: var(--player);
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.4);
    }

    /* The guard's punch clips the acting player's ticket. */
    .ticket.acting::after {
        content: '';
        position: absolute;
        right: 18px;
        top: 40px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #e9dcbc;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
    }

    .band {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 10px;
        background: var(--player);
        color: var(--player-text);
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .cash {
        font-size: 15px;
        font-weight: 700;
    }

    .kind {
        padding: 3px 0;
        border-bottom: 1px dashed #a88a5c;
        font-size: 10px;
        letter-spacing: 0.3em;
        text-align: center;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        font-size: 13px;
    }

    .certs {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
    }

    .cert {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        height: 19px;
        padding: 0 4px;
        border-radius: 2px;
        background: var(--rr);
        color: var(--rr-text);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 10.5px;
        font-weight: 700;
        box-shadow:
            inset 0 0 0 1.5px rgba(255, 255, 255, 0.55),
            0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .control {
        color: #c8961a;
    }

    .leader {
        flex: 1;
        height: 8px;
        border-bottom: 1px dotted #8c6a45;
    }

    .amount {
        font-weight: 700;
    }

    .none {
        padding: 4px 10px;
        font-size: 12px;
        font-style: italic;
        color: #8c6a45;
    }

    .total {
        display: flex;
        justify-content: space-between;
        padding: 4px 10px 2px;
        border-top: 1px dashed #a88a5c;
        font-size: 14px;
        font-weight: 700;
    }

    .fine-print {
        padding: 0 10px 5px;
        font-size: 10.5px;
        color: #8c6a45;
    }
</style>
