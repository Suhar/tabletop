<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { AuctionKind } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RailroadBadge from './RailroadBadge.svelte'

    const gameSession = getGameSession()

    const auction = $derived(gameSession.gameState.auction)
    const bidding = $derived(auction ? gameSession.gameState.bidding() : undefined)
    const smallest = $derived(auction ? gameSession.gameState.smallestBid() : 0)
    const cash = $derived(
        gameSession.myPlayerId ? gameSession.gameState.getPlayerState(gameSession.myPlayerId).cash : 0
    )
    const myBid = $derived(gameSession.bidding && bidding?.currentBidderId === gameSession.myPlayerId)

    // Starts at the smallest legal bid and resets whenever the bid moves on.
    let amount = $derived(smallest)

    function adjust(step: number) {
        amount = Math.min(cash, Math.max(smallest, amount + step))
    }

    const HEADINGS: Record<AuctionKind, string> = {
        [AuctionKind.InitialOffering]: 'Initial offering',
        [AuctionKind.ZasmOpening]: 'The ZASM opens',
        [AuctionKind.OfferStock]: 'Share on offer'
    }
</script>

{#if auction && bidding}
    <div class="auction">
        <div class="heading">
            <span>{HEADINGS[auction.kind]}:</span>
            <RailroadBadge railroadId={auction.railroadId} title />
            {#if auction.sellerId}
                <span>share from <PlayerName playerId={auction.sellerId} /></span>
            {/if}
        </div>
        <div class="terms">
            {#if auction.kind === AuctionKind.OfferStock}
                Minimum bid ${auction.minimum}
            {:else}
                Bids from $0 · if nobody bids, <PlayerName playerId={auction.bidding.auctioneerId} /> takes
                it free
            {/if}
            ·
            {#if bidding.hasBid}
                high bid <strong>${bidding.highBid}</strong> by <PlayerName playerId={bidding.highBidderId} />
            {:else}
                no bids yet
            {/if}
        </div>
        <div class="bidders">
            {#each auction.bidding.participants as participant (participant.playerId)}
                <span
                    class="bidder"
                    class:passed={participant.passed}
                    class:current={participant.playerId === bidding.currentBidderId}
                >
                    <PlayerName playerId={participant.playerId} />
                    {#if participant.bid !== undefined}<span class="amount">${participant.bid}</span>{/if}
                </span>
            {/each}
        </div>
        {#if myBid}
            <div class="controls">
                <button type="button" class="step" onclick={() => adjust(-1)} disabled={amount <= smallest}
                    >−</button
                >
                <span class="value">${amount}</span>
                <button type="button" class="step" onclick={() => adjust(1)} disabled={amount >= cash}
                    >+</button
                >
                <button
                    type="button"
                    class="primary"
                    disabled={amount > cash}
                    onclick={() => gameSession.placeBid(amount)}>Bid ${amount}</button
                >
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
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 18px;
        font-weight: 700;
    }

    .terms {
        font-size: 14px;
        color: #6b4a28;
        text-align: center;
    }

    .bidders {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }

    .bidder {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1.5px solid #c9b48c;
        border-radius: 999px;
        padding: 1px 9px;
        font-size: 14px;
    }

    .bidder.current {
        border-color: #c8961a;
        background: #fff1c2;
    }

    .bidder.passed {
        opacity: 0.45;
        text-decoration: line-through;
    }

    .amount {
        font-weight: 700;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .value {
        min-width: 3.2em;
        text-align: center;
        font-size: 20px;
        font-weight: 700;
    }

    .step {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 2px solid #4a2e17;
        font-size: 20px;
        line-height: 1;
    }

    .step:disabled {
        opacity: 0.35;
    }
</style>
