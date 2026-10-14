<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { AuctionKind } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import BidStepper from './BidStepper.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import ShareCertificate from './ShareCertificate.svelte'
    import Stamp from './Stamp.svelte'

    const gameSession = getGameSession()

    const view = $derived(gameSession.auctionView)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const myBid = $derived(gameSession.bidding && view?.currentBidderId === gameSession.myPlayerId)

    const HEADINGS: Record<AuctionKind, string> = {
        [AuctionKind.InitialOffering]: 'Initial offering',
        [AuctionKind.ZasmOpening]: 'The ZASM opens',
        [AuctionKind.OfferStock]: 'Share on offer'
    }
</script>

{#if view}
    <div class="auction">
        <div class="table">
            <div class="heading">{HEADINGS[view.kind]}</div>
            <BigShareCertificate railroadId={view.railroadId} shrinkOnPhone />
            <div class="seats">
                {#each view.seats as seat (seat.playerId)}
                    {@const current = seat.playerId === view.currentBidderId}
                    <div
                        class="seat"
                        class:passed={seat.passed}
                        class:current
                        style:--player={gameSession.colors.getPlayerUiColor(seat.playerId)}
                    >
                        <span class="name">{gameSession.displayName(seat.playerId)}</span>
                        <span class="amount"
                            >{seat.bid !== undefined ? `$${seat.bid}` : current ? '?' : '—'}</span
                        >
                        {#if seat.passed}
                            <Stamp label="Passed" />
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        <div class="terms">
            {#if view.sellerId}
                Sold by <PlayerName
                    playerId={view.sellerId}
                    capitalization={view.sellerId === gameSession.myPlayerId ? 'none' : 'capitalize'}
                /> ·
            {/if}
            {#if view.kind === AuctionKind.OfferStock}
                Minimum bid ${view.minimum}
            {:else if view.openerId}
                Bids from $0 · unbid, it goes free to <PlayerName
                    playerId={view.openerId}
                    capitalization={view.openerId === gameSession.myPlayerId ? 'none' : 'capitalize'}
                />
            {/if}
        </div>
        {#if view.upcomingOfferings.length > 0}
            <div class="upcoming" role="group" aria-label="Initial offerings still to come">
                <span class="upcoming-label">Up next</span>
                {#each view.upcomingOfferings as railroadId (railroadId)}
                    <ShareCertificate {railroadId} />
                {/each}
            </div>
        {/if}
        {#if myBid}
            <div class="controls">
                <BidStepper
                    minimum={view.smallestBid}
                    maximum={cash}
                    label="Bid"
                    onbid={(amount) => gameSession.placeBid(amount)}
                />
                <button type="button" class="secondary" onclick={() => gameSession.passBid()}
                    >Pass</button
                >
            </div>
        {/if}
    </div>
{/if}

<style>
    .auction {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .heading {
        flex-basis: 100%;
        font-size: 18px;
        font-weight: 700;
        text-align: center;
    }

    .table {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 16px;
    }

    .seats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
    }

    .seat {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 92px;
        border: 1px solid #c9b48c;
        border-left: 14px solid var(--player);
        border-radius: 3px;
        background: #f3e7c4;
        padding: 4px 8px 5px;
    }

    .seat.current {
        border: 2px solid #c8961a;
        border-left: 14px solid var(--player);
        background: #fff3c4;
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.3);
        transform: translateY(-3px);
    }

    .name {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .amount {
        font-size: 22px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .seat.passed .name,
    .seat.passed .amount {
        opacity: 0.4;
    }

    .terms {
        font-size: 13px;
        color: #6b4a28;
        text-align: center;
    }

    .upcoming {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .upcoming-label {
        margin-right: 2px;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #6b4a28;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    @media (max-width: 639px) {
        .auction {
            gap: 4px;
        }

        .table {
            column-gap: 8px;
        }

        .heading {
            flex-basis: auto;
            font-size: 15px;
        }

        .seats {
            flex-basis: 100%;
            gap: 4px;
        }

        .seat,
        .seat.current {
            --stamp-size: 11px;
            min-width: 0;
            border-left-width: 8px;
            padding: 2px 5px 3px;
        }

        .name {
            font-size: 10px;
            letter-spacing: 0.02em;
        }

        .amount {
            font-size: 16px;
        }

        .terms {
            font-size: 12px;
        }

        .controls {
            gap: 6px;
        }

        .secondary {
            padding: 0.25rem 0.7rem;
        }
    }
</style>
