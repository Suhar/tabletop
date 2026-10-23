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
    import { assert } from '@tabletop/common'
    import { EarendelGameSession } from '$lib/model/session.svelte'
    import type { HydratedEarendelGameState, EarendelGameState } from '@tabletop/earendel'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<EarendelGameState, HydratedEarendelGameState> } = $props()
    assert(gameSession instanceof EarendelGameSession, 'Earendel needs its own game session')
    setGameSession(gameSession)

    // One sky per game, from the game's own seed, so it is the same for everyone at the table and
    // survives a reload - and so two games look like two different corners of space. Falls back
    // to the id's characters when a game carries no seed.
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

<!-- Full Height and Width with 8px padding-->
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
            <!--  Top part is not allowed to shrink -->
            <div class="shrink-0">
                <Header />
                {#if gameSession.isViewingHistory}
                    <HistoryDescription />
                {:else}
                    <InformationPanel />
                {/if}
            </div>
            <!--  Bottom part fills the remaining space, but hides overflow to keep it's height fixed.
              This allows the wrapper to scale to its bounds regardless of its content size-->
            <div class="grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>
