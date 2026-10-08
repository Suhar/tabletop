<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        BOX_NAMES,
        actionSale,
        describeAction,
        saleDescription,
        withdrawnBidders
    } from '$lib/utils/describeAction.js'
    import { entryActions, historyEntries, type HistoryEntry } from '$lib/utils/history.js'
    import Description from './Description.svelte'
    import RailroadBadge from './RailroadBadge.svelte'

    const gameSession = getGameSession()

    const entries = $derived(
        historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
        ).toReversed()
    )

    async function jumpTo(entry: HistoryEntry) {
        const index = entryActions(entry).at(-1)?.index
        if (index !== undefined) {
            await gameSession.history.goToActionIndex(index)
        }
    }

    function onKey(event: KeyboardEvent, entry: HistoryEntry) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void jumpTo(entry)
        }
    }

    function detailActions(entry: HistoryEntry): GameAction[] {
        return entry.kind === 'turn' ? entry.actions.slice(1) : entryActions(entry)
    }
</script>

<div class="history">
    {#if gameSession.gameState.result && gameSession.gameState.winningPlayerIds.length > 0}
        <div class="milestone">
            Game over:
            {#each gameSession.gameState.winningPlayerIds as playerId (playerId)}
                <PlayerName {playerId} />
            {/each}
            {gameSession.gameState.winningPlayerIds.length > 1 ? 'share the win' : 'wins'}
        </div>
    {/if}
    {#each entries as entry (entry.key)}
        {#if entry.kind === 'dividend'}
            <div
                class="milestone jump"
                role="button"
                tabindex="0"
                onclick={() => jumpTo(entry)}
                onkeydown={(event) => onKey(event, entry)}
            >
                <Description description={describeAction(entry.action)} />
            </div>
        {:else}
            <section class="entry">
                <div
                    class="head jump"
                    role="button"
                    tabindex="0"
                    title="Show the board after this"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onKey(event, entry)}
                >
                    {#if entry.kind === 'turn'}
                        <PlayerName playerId={entry.playerId} />
                        <span class="box">{BOX_NAMES[entry.box]}</span>
                    {:else}
                        <span>Initial offering</span>
                        {#if entry.railroadId}<RailroadBadge railroadId={entry.railroadId} />{/if}
                    {/if}
                </div>
                {#each detailActions(entry) as action (action.id)}
                    {@const sale = actionSale(action)}
                    <div class="line">
                        {#if action.playerId}<PlayerName playerId={action.playerId} />{/if}
                        <Description description={describeAction(action)} />
                    </div>
                    {#each withdrawnBidders(action) as playerId (playerId)}
                        <div class="line sub"><PlayerName {playerId} /> cannot afford to bid on</div>
                    {/each}
                    {#if sale}
                        <div class="line result"><Description description={saleDescription(sale)} /></div>
                    {/if}
                {/each}
            </section>
        {/if}
    {/each}
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 6px;
        color: #3b2410;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
    }

    .milestone {
        border-radius: 6px;
        background: #4a2e17;
        color: #fbf3dc;
        padding: 4px 8px;
        text-align: center;
    }

    .entry {
        border-radius: 6px;
        background: #fbf5e3;
        box-shadow: inset 0 0 0 1px #c9b48c;
        padding: 4px 8px 6px;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
    }

    .box {
        font-style: italic;
        font-weight: 400;
        color: #6b4a28;
    }

    .jump {
        cursor: pointer;
    }

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding-left: 8px;
    }

    .line.sub {
        color: #8c6a45;
        font-style: italic;
    }

    .line.result {
        font-weight: 700;
    }
</style>
