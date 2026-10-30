<script lang="ts">
    import {
        ScalingWrapper,
        DefaultSideContent,
        DefaultTableLayout,
        GameSession
    } from '@tabletop/frontend-components'

    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import InformationPanel from '$lib/components/InformationPanel.svelte'
    import Starfield from '$lib/components/Starfield.svelte'
    import TechnologyPiles from '$lib/components/TechnologyPiles.svelte'

    import Header from '$lib/components/Header.svelte'
    import HistoryDescription from '$lib/components/HistoryDescription.svelte'
    import GameEndSummary from '$lib/components/GameEndSummary.svelte'
    import { assert } from '@tabletop/common'
    import { EarendelGameSession } from '$lib/model/session.svelte'
    import type { HydratedEarendelGameState, EarendelGameState } from '@tabletop/earendel'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<EarendelGameState, HydratedEarendelGameState> } = $props()
    assert(gameSession instanceof EarendelGameSession, 'Earendel needs its own game session')
    setGameSession(gameSession)

    const skySeed = $derived.by(() => {
        const state = gameSession.gameState
        if (state.prng?.seed) return state.prng.seed
        const id = gameSession.game?.id ?? 'earendel'
        let hash = 0
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
        return hash
    })
</script>

<Starfield seed={skySeed} />

<div style="--chat-height-offset: 0px;">
    <DefaultTableLayout>
        {#snippet sideContent()}
            <DefaultSideContent>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
            </DefaultSideContent>
            <TechnologyPiles />
        {/snippet}
        {#snippet gameContent()}
            <!-- A fixed height, so nothing shown above the board ever moves or rescales it. Content
                 that outgrows it scrolls within it. -->
            <div class="above-board shrink-0 flex flex-col" data-above-board>
                <Header />
                <div class="min-h-0 flex-1 overflow-y-auto">
                    {#if gameSession.isViewingHistory}
                        <HistoryDescription />
                    {:else if gameSession.gameState.result}
                        <GameEndSummary />
                    {:else}
                        <InformationPanel />
                    {/if}
                </div>
            </div>
            <!-- overflow-hidden keeps the height fixed so the wrapper scales to its bounds -->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    /* The board's space never depends on what the action area is showing. */
    .above-board {
        height: 180px;
    }
</style>
