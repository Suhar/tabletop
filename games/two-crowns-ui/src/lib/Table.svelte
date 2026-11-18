<script lang="ts">
    import {
        isConvertCharter,
        isQuarantineTrain,
        isSplitCompany,
        TwoCrownsCompanies,
        TwoCrownsMap
    } from '@tabletop/two-crowns'
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
    import { createRouteWorker } from './routeWorker.js'
    import BranchSplitPreview from './BranchSplitPreview.svelte'
    import Tranches from './Tranches.svelte'
    import RulesButton from './RulesButton.svelte'
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

{#snippet boardTranches()}
    <div class="board-tranches" aria-label="Company tranches">
        <span class="board-tranches-label">Tranches</span>
        <div class="board-tranche-groups">
            <Tranches {session} slotSize={MarketTokenSize * 1.42} layout="stacked" showInitial />
        </div>
    </div>
{/snippet}

<GameTable
    boardPanel={{ label: 'Tranches', content: boardTranches }}
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
                      label: 'Convert the Hungarian Bank to Ganz',
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
            : isConvertCharter(action)
              ? { text: 'Hungarian Bank converted to Ganz', important: true }
              : isQuarantineTrain(action)
                ? {
                      text: `Rijeka Lazaretto: quarantine marker on a ${
                          session.gameState.trainInventory.trains.find(
                              (train) => train.id === action.trainId
                          )?.definitionId ?? 'train'
                      }`,
                      important: true
                  }
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
            {#if session.quarantineTrains.length}
                <div class="lazaretto" aria-label="Rijeka Lazaretto">
                    <span class="lazaretto-label"
                        >Rijeka Lazaretto: close it to mark a train, which runs one more OR when it
                        would rust</span
                    >
                    <div class="lazaretto-trains">
                        {#each session.quarantineTrains as train (train.trainId)}
                            <button
                                class="lazaretto-train"
                                aria-label={`Quarantine the ${train.name}`}
                                onclick={() => session.quarantineTrain(train.trainId)}
                                >Mark {train.name}</button
                            >
                        {/each}
                    </div>
                </div>
            {/if}
            <OperatingActions {privateOperationDescription} onFocusRoute={focusRoute} {session} />
        {/if}
    {/snippet}
    {#snippet headerActions()}<RulesButton />{/snippet}
    {#snippet gameInformation()}
        <div class="tranches" aria-label="Company tranches">
            <span class="tranches-label">Tranches</span>
            <Tranches {session} layout="row" />
        </div>
    {/snippet}
</GameTable>

<style>
    .lazaretto {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
    }
    .lazaretto-label {
        color: var(--rail-muted, #887969);
        font-size: 12px;
    }
    .lazaretto-trains {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .lazaretto-train {
        padding: 2px 10px;
        border: 1px solid var(--rail-border, #b8a995);
        border-radius: 4px;
        font-weight: 600;
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
