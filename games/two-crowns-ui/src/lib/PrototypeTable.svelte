<script lang="ts">
    import { TwoCrownsTrainColors } from './trainPresentation.js'
    import OpeningAuction from './OpeningAuction.svelte'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import { requireTwoCrownsSession } from './session.svelte.js'
    import { setGameSession, type GameSession } from '@tabletop/frontend-components'
    import { untrack } from 'svelte'
    import type { TwoCrownsState, HydratedTwoCrownsState } from '@tabletop/two-crowns'
    import {
        GameEnding,
        FinanceInspector,
        FinanceMap,
        TrainBuying,
        PrivateCompanies,
        CompanyDecisions,
        StockTrading,
        StockMarket,
        setPlaceLinks
    } from '@tabletop/18xx-ui'
    import { lukaShares, lukaPresident } from '@tabletop/two-crowns'
    let { gameSession }: { gameSession: GameSession<TwoCrownsState, HydratedTwoCrownsState> } =
        $props()
    const session = $derived(requireTwoCrownsSession(gameSession))
    const gameState = $derived(gameSession.gameState)
    setGameSession(untrack(() => session))
    setPlaceLinks({
        name: (locationId) => session.placeName(locationId),
        reveal: (locationId) => session.map.inspect({ kind: 'hex', locationId })
    })
</script>

<GameEnding {session} />

{#if session.offers.model && !session.offers.model.auction.completed}
    <OpeningAuction {session} />
{:else}
    <BranchSplitPreview {session} />
    <CompanyDecisions {session} trainColors={TwoCrownsTrainColors} />
    <PrivateCompanies {session} />
    <TrainBuying {session} trainColors={TwoCrownsTrainColors} />
    <FinanceMap {session} />
    <StockTrading {session} />
    <StockMarket
        animation={session.marketAnimation}
        appearances={session.mapView.stations}
        chart={session.stockMarketChart}
        market={gameState.stockMarket}
        companyName={(companyId) => session.companyName(companyId)}
    />

    {#if gameState.tranches.length}<section class="tranches" aria-label="Company tranches">
            {#each gameState.tranches as tranche (tranche.id)}<p>
                    {tranche.name}: {tranche.companyIds.join(' · ') || 'Empty'} ({tranche.companyIds
                        .length}/{tranche.capacity})
                </p>{/each}
        </section>{/if}
    <p class="luka-summary">
        LUKA: {gameState.companies.find((company) => company.id === 'LUKA')?.closed
            ? 'Closed.'
            : ''}
        {lukaShares(gameState).length} outstanding shares. President: {gameSession.game.players.find(
            (player) => player.id === lukaPresident(gameState)
        )?.name}. Largest shareholding wins; ties go to the lowest numbered share.
    </p>
{/if}

<FinanceInspector
    names={session.names}
    charters={session.charters}
    stations={gameState.stations}
    stationReservations={gameState.stationReservations}
    certificateWeight={session.certificateWeight}
    {gameState}
    players={gameSession.game.players}
    playerStates={gameState.players}
>
    {#snippet certificateDetail(certificate)}
        {#if certificate.kind === 'share' && certificate.companyId === 'LUKA'}
            <p class="share-income">
                1/{lukaShares(gameState).length} of LUKA’s distributed earnings
            </p>
        {/if}
    {/snippet}
</FinanceInspector>

<style>
    .tranches {
        margin-bottom: 16px;
        font-size: 13px;
    }
    .luka-summary {
        margin: 0 0 20px;
        color: #3e5c50;
        font:
            13px/1.5 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .share-income {
        margin: 6px 0 0;
        color: var(--rail-text, #46674f);
        font-size: 12px;
    }
</style>
