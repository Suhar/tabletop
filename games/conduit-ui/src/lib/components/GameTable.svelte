<script lang="ts">
    import { untrack } from 'svelte'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import type { ConduitProjectedState, HydratedConduitGameState } from '@tabletop/conduit'
    import { ConduitGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'
    import Header from './Header.svelte'
    import ActionArea from './action/ActionArea.svelte'
    import RulesPanel from './RulesPanel.svelte'
    import Table from './table/Table.svelte'
    import PlacementPicker from './table/PlacementPicker.svelte'
    import PlayersPanel from './side/PlayersPanel.svelte'
    import History from './side/History.svelte'

    let {
        gameSession
    }: { gameSession: GameSession<ConduitProjectedState, HydratedConduitGameState> } = $props()

    function ensureConduitGameSession(
        session: GameSession<ConduitProjectedState, HydratedConduitGameState>
    ): ConduitGameSession {
        if (session instanceof ConduitGameSession) {
            return session
        }
        throw new Error('GameTable expected a ConduitGameSession')
    }

    const session = untrack(() => ensureConduitGameSession(gameSession))
    setGameSession(session)
</script>

<div class="conduit-table" aria-busy={gameSession.busy}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <div class="controls">
                <HistoryControls
                    borderClass=""
                    bgClass="bg-transparent"
                    enabledColor="conduit-control-on"
                    disabledColor="conduit-control-off"
                />
            </div>
        {/snippet}
        {#snippet sideContent()}
            <div class="controls framed max-sm:hidden">
                <HistoryControls
                    borderClass=""
                    bgClass="bg-transparent"
                    enabledColor="conduit-control-on"
                    disabledColor="conduit-control-off"
                />
            </div>
            <DefaultTabs
                activeTabClass="conduit-tab conduit-tab-active"
                inactiveTabClass="conduit-tab"
            >
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat
                        bgColor="bg-(--conduit-panel)"
                        borderColor="border-(--conduit-line)"
                        timeColor="text-(--conduit-muted)"
                        messageTextColor="text-(--conduit-ink)"
                        composerTextColor="text-(--conduit-ink)"
                        messageHoverColor="hover:bg-(--conduit-panel-raised)"
                        inputBgColor="bg-(--conduit-panel-raised)"
                        inputBorderColor="border-(--conduit-line)"
                    />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionArea />
            </div>
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <div class="h-full w-full" inert={session.rulesOpen}>
                    <ScalingWrapper
                        justify={session.tableBeside ? 'left' : 'center'}
                        controls={session.tableBeside ? 'bottom-right' : 'bottom-left'}
                        coverBelowScale={0.3}
                        expandable
                    >
                        <Table />
                        {#snippet toolbar()}
                            <PlacementPicker />
                        {/snippet}
                    </ScalingWrapper>
                </div>
                {#if session.rulesOpen}
                    <RulesPanel />
                {/if}
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .conduit-table {
        --conduit-bg: #10161f;
        --conduit-panel: #18212d;
        --conduit-panel-raised: #222e3d;
        --conduit-line: #33445a;
        --conduit-ink: #e8eef6;
        --conduit-muted: #93a4b8;
        --conduit-accent: #f5c542;
        --conduit-accent-ink: #1b1505;
        --conduit-live: #57d3ff;
        --conduit-danger: #f0433a;
        --conduit-paper: #f4f1e8;
        --conduit-paper-ink: #1d2430;
        position: relative;
        isolation: isolate;
        color: var(--conduit-ink);
        background:
            radial-gradient(ellipse 70% 40% at 50% -10%, rgb(87 211 255 / 0.12), transparent 70%),
            var(--conduit-bg);
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    }

    .controls {
        background: var(--conduit-panel);
    }

    .controls.framed {
        border-radius: 8px;
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .conduit-table :global(.conduit-control-on) {
        color: var(--conduit-ink);
    }

    .conduit-table :global(.conduit-control-off) {
        color: rgb(255 255 255 / 0.25);
    }

    .conduit-table :global([role='tablist']:has(.conduit-tab)) {
        gap: 4px;
        margin: 0;
        padding: 4px 0 6px;
        border-bottom: none;
    }

    .conduit-table :global([role='tablist']:has(.conduit-tab) > li) {
        display: flex;
        flex: 1;
        margin: 0;
    }

    .conduit-table :global(.conduit-tab) {
        flex: 1;
        padding: 5px 8px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--conduit-muted);
        border-radius: 6px;
        background: var(--conduit-panel);
        box-shadow: inset 0 0 0 1px var(--conduit-line);
    }

    .conduit-table :global(.conduit-tab > div) {
        justify-content: center;
    }

    .conduit-table :global(.conduit-tab:hover) {
        color: var(--conduit-ink);
    }

    .conduit-table :global(.conduit-tab.conduit-tab-active) {
        color: var(--conduit-accent-ink);
        background: var(--conduit-accent);
        box-shadow: none;
    }
</style>
