<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        MachineState,
        freeBuildHome,
        railroadDefinition,
        settlement
    } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { linkName } from '$lib/utils/describeAction.js'
    import AuctionPanel from './AuctionPanel.svelte'
    import BigShareCertificate from './BigShareCertificate.svelte'
    import RailroadBadge from './RailroadBadge.svelte'
    import WaitingView from './WaitingView.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const machineState = $derived(state.machineState)
    const me = $derived(gameSession.myPlayerId)
    const holdings = $derived(me ? state.holdings(me) : [])
</script>

{#snippet railroadChoices()}
    <div class="row">
        {#each gameSession.railroadChoices as railroadId (railroadId)}
            <button
                type="button"
                class="secondary"
                onclick={() => gameSession.selectRailroad(railroadId)}
                ><RailroadBadge {railroadId} /></button
            >
        {/each}
    </div>
{/snippet}

<div class="panel">
    {#if gameSession.isViewingHistory}
        <WaitingView />
    {:else if machineState === MachineState.Bidding}
        <AuctionPanel />
    {:else if !gameSession.canAct}
        <WaitingView />
    {:else if machineState === MachineState.FreeBuild && state.freeBuild}
        <p class="prompt">
            Lay the <RailroadBadge railroadId={state.freeBuild.railroadId} /> free first link out of
            {settlement(freeBuildHome(state.freeBuild.railroadId)).name}: choose a highlighted link.
        </p>
    {:else if machineState === MachineState.ChoosingAction}
        <p class="prompt">Choose an action below.</p>
    {:else if machineState === MachineState.ConstructingTrack || machineState === MachineState.DelegatedBuild}
        {#if gameSession.delegating}
            {#if gameSession.selectedRailroad && gameSession.delegateBuilders.length > 1}
                <p class="prompt">
                    Who builds for the <RailroadBadge railroadId={gameSession.selectedRailroad} />?
                </p>
                <div class="row">
                    {#each gameSession.delegateBuilders as builderId (builderId)}
                        <button
                            type="button"
                            class="secondary"
                            onclick={() =>
                                gameSession.selectedRailroad &&
                                gameSession.delegateBuild(gameSession.selectedRailroad, builderId)}
                            ><PlayerName playerId={builderId} /></button
                        >
                    {/each}
                </div>
            {:else}
                <p class="prompt">
                    You control no railroad that can build. Choose one; its controlling
                    shareholder builds.
                </p>
                {@render railroadChoices()}
            {/if}
        {:else if !gameSession.selectedRailroad}
            <p class="prompt">Choose which of your railroads builds.</p>
            {@render railroadChoices()}
        {:else if gameSession.firstLink}
            <p class="prompt">
                {linkName(gameSession.firstLink)} chosen. Add a second link for $15 in all, or build
                this one alone.
            </p>
            <div class="row">
                <button type="button" class="primary" onclick={() => gameSession.buildFirstLinkAlone()}
                    >Build one link · $5</button
                >
            </div>
        {:else}
            <p class="prompt">
                Build for the <RailroadBadge railroadId={gameSession.selectedRailroad} /> (treasury ${state.railroad(
                    gameSession.selectedRailroad
                ).treasury}): one link $5{#if state.doubleBuilds(gameSession.selectedRailroad).length > 0}, two
                    links $15{/if}{#if gameSession.connectionTargets.length > 0}, or a connection{/if}.
            </p>
        {/if}
    {:else if machineState === MachineState.DevelopingSettlements}
        <p class="prompt">
            {#if state.developmentsThisTurn === 0}
                Develop a settlement served by a railroad, or Johannesburg.
            {:else}
                Develop a second settlement for $3 of your own cash, or Johannesburg free.
            {/if}
        </p>
        <p class="effects">
            It moves to its next income, and every railroad link into it earns the difference.
        </p>
        {#if gameSession.mayFinishDeveloping}
            <div class="row">
                <button type="button" class="secondary" onclick={() => gameSession.finishDevelopment()}
                    >Stop after one</button
                >
            </div>
        {/if}
    {:else if machineState === MachineState.OfferingStock}
        <p class="prompt">
            {#if state.unsoldOffers().length > 0 && holdings.length > 0}
                Offer a railroad's unsold share, or sell one of your own.
            {:else if state.unsoldOffers().length > 0}
                Offer a railroad's unsold share.
            {:else}
                Every share is sold. You may sell one of your own.
            {/if}
        </p>
        {#if state.unsoldOffers().length > 0}
            <div class="row" role="group" aria-label="Railroad shares">
                {#each state.unsoldOffers() as railroadId (railroadId)}
                    <BigShareCertificate
                        {railroadId}
                        choice={{
                            label: `Offer a ${railroadDefinition(railroadId).shortName} share`,
                            onclick: () => gameSession.offerShare(railroadId, false)
                        }}
                    />
                {/each}
            </div>
        {/if}
        {#if holdings.length > 0}
            <div class="row" role="group" aria-label="Your shares">
                <span class="group-label">Yours</span>
                {#each holdings as holding (holding.railroadId)}
                    <BigShareCertificate
                        railroadId={holding.railroadId}
                        choice={{
                            label: `Sell one of your ${railroadDefinition(holding.railroadId).shortName} shares`,
                            onclick: () => gameSession.offerShare(holding.railroadId, true)
                        }}
                    />
                {/each}
            </div>
        {/if}
        {#if state.unsoldOffers().length === 0}
            <div class="row">
                <button type="button" class="secondary" onclick={() => gameSession.declineOffer()}
                    >Offer nothing</button
                >
            </div>
        {/if}
    {:else}
        <WaitingView />
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .prompt {
        margin: 0;
        font-size: 16px;
        text-align: center;
    }

    .effects {
        margin: 0;
        font-size: 13px;
        font-style: italic;
        color: #6b4a28;
        text-align: center;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .group-label {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #6b4a28;
    }

    @media (max-width: 639px) {
        .panel {
            padding: 4px 6px;
        }

        .prompt {
            font-size: 14px;
        }
    }
</style>
