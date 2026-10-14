<script lang="ts">
    import { RAILROADS, type HydratedSarPlayerState } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShareCertificate from './ShareCertificate.svelte'

    let { playerState }: { playerState: HydratedSarPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const acting = $derived(gameSession.shownState.activePlayerIds.includes(playerId))
    const lines = $derived(
        RAILROADS.map((railroad) => {
            const shares = gameSession.shownState.sharesHeld(railroad.id, playerId)
            const each = gameSession.shownState.nextDividendPerShare(railroad.id)
            return {
                railroad,
                shares,
                each,
                amount: shares * each,
                controls: gameSession.shownState.controls(railroad.id, playerId)
            }
        }).filter((line) => line.shares > 0)
    )
    const finalPayoffNext = $derived(gameSession.shownState.isFinalPayoffNext())
    const dividend = $derived(gameSession.shownState.nextDividend(playerId))
    const projected = $derived(gameSession.shownState.projectedFinalCash(playerId))
</script>

<div class="ticket" class:acting style:--player={color}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="cash" title="Cash in hand">${playerState.cash}</span>
    </div>
    {#each lines as line (line.railroad.id)}
        <div
            class="line"
            title="{line.railroad.shortName}: ${line.each} a share{line.controls
                ? ' · controls the railroad'
                : ''}"
        >
            <span class="certs">
                {#each Array.from({ length: line.shares }, (_, index) => index) as share (share)}
                    <ShareCertificate railroadId={line.railroad.id} />
                {/each}
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
        Score if game ended now ${projected}
    </div>
</div>

<style>
    .ticket {
        position: relative;
        overflow: hidden;
        border: 3px solid #f3e7c4;
        border-radius: 5px;
        padding-left: 16px;
        background: #f3e7c4;
        color: #3b2410;
        font-family: 'Courier Prime', 'Courier New', monospace;
        box-shadow: 0 2px 4px rgba(40, 24, 8, 0.3);
    }

    .ticket::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 16px;
        background: var(--player);
        box-shadow: inset -1.5px 0 0 rgba(0, 0, 0, 0.3);
    }

    .ticket.acting {
        border-color: var(--player);
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.4);
    }

    .band {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 10px;
        border-bottom: 1px dashed #a88a5c;
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

    .leader {
        flex: 1;
        height: 8px;
        border-bottom: 1px dotted #8c6a45;
    }

    .amount {
        font-variant-numeric: tabular-nums;
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
        font-size: 15px;
        font-weight: 700;
    }

    .fine-print {
        padding: 0 10px 5px;
        font-size: 10.5px;
        color: #8c6a45;
    }
</style>
