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
    import ElevatedDeck from '$lib/components/ElevatedDeck.svelte'
    import PiecesInPlay from '$lib/components/PiecesInPlay.svelte'
    import { onMount } from 'svelte'
    import { HandAnimator } from '$lib/animators/handAnimator.svelte.js'
    import { setHandAnimator } from '$lib/model/handAnimatorContext.js'

    import Header from '$lib/components/Header.svelte'
    import TitleCard from '$lib/components/TitleCard.svelte'
    import RulesOverview from '$lib/components/RulesOverview.svelte'
    import HistoryDescription from '$lib/components/HistoryDescription.svelte'
    import Hand from '$lib/components/Hand.svelte'
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

    // The draw's deal lives in the action area, so its animator is made here, where the area
    // is, and the bag and the panel find it by context.
    // Whose hand is on show: the viewer's, or in history whoever's turn is being looked at.
    const handAnimator = new HandAnimator(() =>
        gameSession.isViewingHistory
            ? gameSession.gameState.activePlayerIds[0]
            : gameSession.myPlayer?.id
    )
    setHandAnimator(handAnimator)
    onMount(() => {
        const listener = handAnimator.onGameStateChange.bind(handAnimator)
        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

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
            <ElevatedDeck />
            <PiecesInPlay />
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
                        <!-- What happened, and under it the hand of whoever's turn it was, turning
                             and dealing as the actions replay. -->
                        <div class="flex flex-col items-center pt-1">
                            <HistoryDescription />
                            <Hand cards interactive={false} />
                        </div>
                    {:else if gameSession.gameState.result}
                        <GameEndSummary />
                    {:else}
                        <InformationPanel />
                    {/if}
                </div>
            </div>
            <!-- overflow-hidden keeps the height fixed so the wrapper scales to its bounds -->
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    <Board />
                </ScalingWrapper>
                {#if gameSession.titleStage !== 'hidden'}
                    <TitleCard />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

{#if gameSession.overviewShown}
    <RulesOverview />
{/if}

<style>
    /* The board's space never depends on what the action area is showing. */
    .above-board {
        height: 180px;
    }
</style>
