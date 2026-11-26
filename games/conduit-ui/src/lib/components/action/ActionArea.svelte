<script lang="ts">
    import { MachineState, MinimumBids, stationTile } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/historyEntries.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const name = (playerId: string) => gameSession.getPlayerName(playerId)
    const activeId = $derived(state.activePlayerIds[0])
    const letterOf = (tileId: number) => stationTile(tileId).letter

    const standings = $derived(
        [...state.players].sort((a, b) => b.cash - a.cash || b.supply - a.supply)
    )
    const lastMove = $derived.by(() => {
        const action = gameSession.actions.findLast((candidate) => candidate.playerId)
        return action ? describeAction(action, name) : undefined
    })
    const myBids = $derived(gameSession.myPlayer ? state.bidsBy(gameSession.myPlayer.id) : 0)

    function tollLabel(tolls: string[]): string {
        if (tolls.length === 0) return 'No toll'
        const totals = new Map<string, number>()
        for (const playerId of tolls) totals.set(playerId, (totals.get(playerId) ?? 0) + 1)
        return [...totals].map(([playerId, amount]) => `${name(playerId)} +$${amount}`).join(', ')
    }
</script>

<section
    class="card"
    class:settling={gameSession.busy}
    class:steady={gameSession.tableBeside}
    aria-label="Actions"
>
    {#if gameSession.isViewingHistory}
        <p class="prompt">
            {gameSession.currentAction
                ? (describeAction(gameSession.currentAction, name) ?? 'Setup')
                : 'Setup'}
        </p>
    {:else if state.result}
        <p class="prompt">
            {state.winningPlayerIds.map(name).join(' and ')}
            {state.winningPlayerIds.length === 1 ? 'wins' : 'share the win'}
        </p>
        <ol class="standings">
            {#each standings as seat (seat.playerId)}
                <li>
                    <span>{name(seat.playerId)}</span><span>${seat.cash}</span><span class="detail"
                        >{seat.supply} in supply</span
                    >
                </li>
            {/each}
        </ol>
    {:else if gameSession.isBidding}
        <p class="prompt">{gameSession.canPassBid ? 'Bid on a tile or pass' : 'Bid on a tile'}</p>
        <p class="detail">
            {#if myBids < MinimumBids}Bids {myBids} of {MinimumBids} ·{' '}{/if}{gameSession.mySupply}
            in supply
        </p>
        {#if gameSession.canPassBid}
            <div class="buttons">
                <button type="button" class="choice" onclick={() => gameSession.passBid()}
                    >Pass</button
                >
            </div>
            <p class="detail">You can't bid again this round</p>
        {/if}
    {:else if gameSession.isOffered && gameSession.offer}
        {@const offer = gameSession.offer}
        <p class="prompt">Buy the {letterOf(offer.tileId)} tile for ${offer.price}?</p>
        <div class="buttons">
            <button
                type="button"
                class="choice buy"
                disabled={!gameSession.canBuy}
                onclick={() => gameSession.buyTile()}>Buy ${offer.price}</button
            >
            <button type="button" class="choice" onclick={() => gameSession.passTile()}
                >Pass +$1</button
            >
        </div>
        {#if !gameSession.canBuy}
            <p class="detail">You can't afford it</p>
        {/if}
    {:else if gameSession.placement}
        {@const placement = gameSession.placement}
        <p class="prompt">
            {placement.faceUp
                ? `Place your ${letterOf(placement.tileId)} tile`
                : `Place the ${letterOf(placement.tileId)} tile face down`}
        </p>
        {#if !placement.faceUp}
            <p class="detail">Nobody bought it</p>
        {/if}
    {:else if gameSession.routeChoice}
        {@const choice = gameSession.routeChoice}
        <p class="prompt">Who gets the toll from your {letterOf(choice.tileId)} station?</p>
        <p class="detail">These routes tie; you choose</p>
        <div class="buttons">
            {#each choice.options as option, index (index)}
                <button
                    type="button"
                    class="choice"
                    class:focused={gameSession.focusedOption === index}
                    onclick={() => gameSession.chooseRoute(index)}
                    onmouseenter={() => gameSession.previewRoute(index)}
                    onfocus={() => gameSession.previewRoute(index)}
                    onmouseleave={() => gameSession.previewRoute(undefined)}
                    onblur={() => gameSession.previewRoute(undefined)}
                    >{tollLabel(option.tolls)}</button
                >
            {/each}
        </div>
    {:else if state.machineState === MachineState.ChoosingRoutes && gameSession.shownRouteChoice}
        {@const choice = gameSession.shownRouteChoice}
        <p class="prompt">
            {name(choice.playerId)} is choosing who gets the toll from their {letterOf(
                choice.tileId
            )} station
        </p>
    {:else if state.machineState === MachineState.Bidding && activeId}
        <p class="prompt">{name(activeId)} is bidding</p>
    {:else if state.machineState === MachineState.Offering && gameSession.offer}
        <p class="prompt">
            {name(gameSession.offer.playerId)} may buy the {letterOf(gameSession.offer.tileId)} tile for
            ${gameSession.offer.price}
        </p>
    {:else if state.machineState === MachineState.Placing && gameSession.pendingPlacement}
        <p class="prompt">
            {name(gameSession.pendingPlacement.playerId)} is placing the {letterOf(
                gameSession.pendingPlacement.tileId
            )} tile
        </p>
    {:else}
        <p class="prompt">Paying revenue</p>
    {/if}
    {#if !gameSession.isViewingHistory && !state.result && !gameSession.isMyTurn && lastMove}
        <p class="detail">Last: {lastMove}</p>
    {/if}
</section>

<style>
    .card {
        margin: 0 8px 8px;
        padding: 12px 16px;
        border-radius: 10px;
        background: var(--conduit-panel);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    /* Beside the auction, the table fits the height left below this card; one height for every
       prompt keeps the table, and so the auction board, from rescaling at each turn. */
    .steady {
        min-height: 140px;
    }

    .settling {
        pointer-events: none;
    }

    .prompt {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.3;
    }

    .detail {
        margin-top: 2px;
        font-size: 14px;
        color: var(--conduit-muted);
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
    }

    .choice {
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 15px;
        font-weight: 700;
        color: var(--conduit-ink);
        background: var(--conduit-panel-raised);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .choice.focused {
        box-shadow: inset 0 0 0 2px var(--conduit-live);
    }

    .choice.buy {
        color: var(--conduit-accent-ink);
        background: var(--conduit-accent);
        box-shadow: none;
    }

    .choice:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .standings {
        margin-top: 8px;
        display: grid;
        gap: 2px;
        font-size: 15px;
    }

    .standings li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 12px;
        align-items: baseline;
    }

    @media (max-width: 639px) {
        .card {
            padding: 8px 10px;
        }

        .prompt {
            font-size: 16px;
        }
    }
</style>
