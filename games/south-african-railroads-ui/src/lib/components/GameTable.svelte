<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import {
        ScalingWrapper,
        DefaultTableLayout,
        CustomFont,
        GameSession,
        GameChat,
        HistoryControls,
        DefaultTabs
    } from '@tabletop/frontend-components'
    import { assert } from '@tabletop/common'
    import type { HydratedSarGameState, SarGameState } from '@tabletop/south-african-railroads'
    import History from '$lib/components/History.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import Board from '$lib/components/Board.svelte'
    import Header from '$lib/components/Header.svelte'
    import ActionPanel from '$lib/components/ActionPanel.svelte'
    import ActionBoxes from '$lib/components/ActionBoxes.svelte'
    import GameEndPanel from '$lib/components/GameEndPanel.svelte'
    import { SarGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import LibreBaskervilleFont from '$lib/fonts/LibreBaskerville.woff2'
    import LibreBaskervilleItalicFont from '$lib/fonts/LibreBaskerville-Italic.woff2'
    import CourierPrimeFont from '$lib/fonts/CourierPrime-Regular.woff2'
    import CourierPrimeBoldFont from '$lib/fonts/CourierPrime-Bold.woff2'

    let { gameSession }: { gameSession: GameSession<SarGameState, HydratedSarGameState> } =
        $props()
    assert(gameSession instanceof SarGameSession, 'South African Railroads needs its own session')
    setGameSession(gameSession)

    // The shared wrapper exposes full screen only as its dialog becoming modal.
    let expanded = $state(false)
    const watchExpansion: Attachment<HTMLElement> = (node) => {
        const dialog = node.closest('dialog')
        if (!dialog) return
        const read = () => {
            expanded = dialog.matches(':modal')
        }
        const observer = new MutationObserver(read)
        observer.observe(dialog, { attributes: true, attributeFilter: ['role'] })
        read()
        return () => observer.disconnect()
    }
</script>

{#snippet turnControls()}
    <Header />
    <div class="action-area">
        {#if gameSession.gameState.result}
            <GameEndPanel />
        {:else}
            <ActionPanel />
        {/if}
    </div>
    {#if !gameSession.gameState.result}
        <ActionBoxes />
    {/if}
{/snippet}

<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleFont}
    format="woff2"
    fontWeight="400 700"
/>
<CustomFont
    fontFamily="Libre Baskerville"
    url={LibreBaskervilleItalicFont}
    format="woff2"
    fontWeight="400 700"
    fontStyle="italic"
/>
<CustomFont fontFamily="Courier Prime" url={CourierPrimeFont} format="woff2" fontWeight="400" />
<CustomFont
    fontFamily="Courier Prime"
    url={CourierPrimeBoldFont}
    format="woff2"
    fontWeight="700"
/>

<div class="bg-[#e9dcbc]">
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls
                enabledColor="text-[#4a2e17]"
                disabledColor="text-[#c4ad84]"
                borderClass="border-[#4a2e17] border-b-2"
            />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden">
                <HistoryControls
                    enabledColor="text-[#4a2e17]"
                    disabledColor="text-[#c4ad84]"
                    borderClass="rounded-lg border-2 border-[#4a2e17]"
                />
            </div>
            <DefaultTabs
                playersTitle="Investors"
                activeTabClass="py-1 px-3 bg-[#4a2e17] border-2 border-transparent rounded-lg text-[#fbf3dc]"
                inactiveTabClass="text-[#4a2e17] py-1 px-3 rounded-lg border-2 border-transparent hover:border-[#4a2e17]"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        timeColor="text-gray-500"
                        bgColor="bg-black"
                        inputBgColor="bg-black"
                        inputBorderColor="border-gray-500"
                        borderColor="border-gray-500"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                {@render turnControls()}
            </div>
            <div class="grow-0 overflow-hidden pt-2" style="flex:1; min-height: 40dvh;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    <Board />
                    {#snippet toolbar()}
                        <!-- Full screen is a modal dialog, so the turn controls must come inside it. -->
                        <div {@attach watchExpansion}>
                            {#if expanded}
                                <div class="fullscreen-controls">
                                    {@render turnControls()}
                                </div>
                            {/if}
                        </div>
                    {/snippet}
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .action-area {
        margin: 0 8px;
        border: 2px solid #4a2e17;
        border-radius: 12px;
        background: #fbf5e3;
        box-shadow: 0 2px 6px rgba(40, 24, 8, 0.18);
    }

    .fullscreen-controls {
        padding-bottom: 8px;
        background: #e9dcbc;
    }
</style>
