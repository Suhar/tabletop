<script lang="ts">
    import {
        berthPrice,
        isAssignAncona,
        isBuyBerth,
        isConvertCharter,
        isSplitCompany,
        TwoCrownsCompanies,
        TwoCrownsMap
    } from '@tabletop/two-crowns'
    import { EighteenXXTransferTiming } from '@tabletop/18xx'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { TwoCrownsState, HydratedTwoCrownsState } from '@tabletop/two-crowns'
    import {
        GameTable,
        MarketTokenSize,
        OperatingActions,
        AuctionOffers,
        OfferAuctionBidding
    } from '@tabletop/18xx-ui'
    import { requireTwoCrownsSession } from './session.svelte.js'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import Tranches from './Tranches.svelte'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<TwoCrownsState, HydratedTwoCrownsState> } =
        $props()
    function lotInfo(id: string) {
        const privateCompany = session.privates.companies.find((company) => company.id === id)
        if (privateCompany) return { description: privateCompany.description }
        const share = session.gameState.certificates.find((certificate) => certificate.id === id)
        const company =
            share?.kind === 'share'
                ? TwoCrownsCompanies.find((company) => company.number === share.number)
                : undefined
        const locationId = company ? numberedShareLocation('LUKA', company.number) : undefined
        return {
            locationId,
            description: `A numbered Luka share associated with ${company?.name}. Receives a share of the Luka's dividends while outstanding. It may be exchanged when the associated railway is formed and is worth $80 at game end.`
        }
    }
    function numberedShareLocation(companyId: string, number: number) {
        if (companyId !== 'LUKA') return undefined
        const company = TwoCrownsCompanies.find((company) => company.number === number)
        return TwoCrownsMap.definition.locations.find((location) =>
            location.reservations?.some(
                (reservation) => reservation.companyId === company?.companyId
            )
        )?.id
    }
    const session = $derived(requireTwoCrownsSession(gameSession))
    const privateOperationDescription = (id: string, companyId: string) =>
        id === 'P10' && companyId !== 'LUKA'
            ? 'Close to buy one depot train during the company’s turn, paying the normal train price.'
            : undefined
</script>

<GameTable
    additionalStockActions={[
        ...(session.splitMenuAvailable
            ? [
                  {
                      label: 'Split',
                      selected: session.splitInProgress,
                      onSelect: () => session.chooseSplit()
                  }
              ]
            : []),
        ...(session.titleActionAvailable('ConvertCharter')
            ? [
                  {
                      label: 'Convert charter to Ganz',
                      selected: false,
                      onSelect: () => session.convertCharter()
                  }
              ]
            : [])
    ]}
    historyDescription={(action, { companyName }) =>
        isSplitCompany(action)
            ? {
                  text: `Split ${companyName(action.branchId)} from ${companyName(action.parentId)}`,
                  value: session.presentation.money(action.expectedFunding),
                  detail: 'Branch capital',
                  important: true
              }
            : isBuyBerth(action)
              ? {
                    text: `${companyName(action.companyId)} bought a Berth`,
                    value: session.presentation.money(action.metadata?.price ?? 0),
                    important: true
                }
              : isAssignAncona(action)
                ? {
                      text: `Ancona Steamship Line assigned to ${companyName(action.companyId)}`,
                      important: true
                  }
                : isConvertCharter(action)
                  ? { text: 'Ungaro-Croata Charter converted to Ganz', important: true }
                  : undefined}
    {numberedShareLocation}
    auctionLotDescription={(id) => lotInfo(id).description}
    {session}
    {privateOperationDescription}
    {createRouteWorker}
>
    {#snippet actions(focusLocation, focusRoute)}
        {#if session.offers.model && !session.offers.model.auction.completed}
            {#if !session.offers.model.auction.bidding && !session.offers.model.auction.stalled}
                <AuctionOffers {session} {lotInfo} onFocus={focusLocation} />
            {:else if session.offers.model.auction.bidding}
                <OfferAuctionBidding {session} {lotInfo} />
            {:else}
                <OpeningAuction {session} showUndo={false} />
            {/if}
        {:else if session.splitInProgress}
            <BranchSplitPreview {session} showUndo={false} onFocusLocation={focusLocation} />
        {:else}
            {@const operating = EighteenXXTransferTiming.operatingCompany(session.gameState)}
            {#if operating && (session.titleActionAvailable('BuyBerth') || session.titleActionAvailable('AssignAncona'))}
                <div class="title-actions">
                    {#if session.titleActionAvailable('BuyBerth')}
                        <button type="button" onclick={() => session.buyBerth()}>
                            Buy a Berth ({session.presentation.money(
                                berthPrice(session.gameState, operating)
                            )})
                        </button>
                    {/if}
                    {#if session.titleActionAvailable('AssignAncona')}
                        <button type="button" onclick={() => session.assignAncona()}>
                            Assign the Ancona Steamship Line
                        </button>
                    {/if}
                </div>
            {/if}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
    {#snippet gameInformation()}
        <div class="tranches" aria-label="Company tranches">
            <span class="tranches-label">Tranches</span>
            <Tranches {session} layout="row" />
        </div>
    {/snippet}
    {#snippet boardInformation()}
        <div class="board-tranches" aria-label="Company tranches">
            <span class="board-tranches-label">Tranches</span>
            <div class="board-tranche-groups">
                <Tranches
                    {session}
                    slotSize={MarketTokenSize * 1.42}
                    layout="stacked"
                    showInitial
                />
            </div>
        </div>
    {/snippet}
</GameTable>

<style>
    .title-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 8px;
    }
    .title-actions button {
        padding: 4px 10px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 4px;
        background: var(--rail-surface, #fffaf0);
        cursor: pointer;
    }
    .tranches {
        display: flex;
        align-items: center;
        gap: 0;
        flex: none;
        margin-top: -8px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
    }
    @media (width < 64rem) {
        .tranches {
            margin-top: 0;
        }
    }
    .tranches-label {
        color: var(--rail-muted, #887969);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        line-height: 1;
        margin-right: 3px;
    }
    .board-tranches {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 11px;
        margin-right: auto;
        padding-left: 62px;
    }
    .board-tranches-label {
        color: var(--rail-muted, #7f8e9e);
        font-size: 18px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .board-tranche-groups {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }
</style>
