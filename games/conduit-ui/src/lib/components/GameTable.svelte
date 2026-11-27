<script lang="ts">
    import { untrack } from 'svelte'
    import {
        CustomFont,
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
    import AudiowideFont from '$lib/fonts/Audiowide-400.woff2'
    import ShareTechMonoFont from '$lib/fonts/ShareTechMono-400.woff2'
    import OcrAFont from '$lib/fonts/OCRA.otf'
    import ProseRegular from '$lib/fonts/Merriweather-400-normal.woff2'
    import ProseItalic from '$lib/fonts/Merriweather-400-italic.woff2'
    import ProseBold from '$lib/fonts/Merriweather-700-normal.woff2'
    import ProseBoldItalic from '$lib/fonts/Merriweather-700-italic.woff2'
    import CircuitBoard from '$lib/images/circuit-board.webp'

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

<CustomFont fontFamily="Conduit Display" url={AudiowideFont} format="woff2" />
<CustomFont fontFamily="Conduit Mono" url={ShareTechMonoFont} format="woff2" />
<CustomFont fontFamily="Conduit OCR" url={OcrAFont} format="opentype" />
<CustomFont fontFamily="Conduit Prose" url={ProseRegular} format="woff2" />
<CustomFont fontFamily="Conduit Prose" url={ProseItalic} format="woff2" fontStyle="italic" />
<CustomFont fontFamily="Conduit Prose" url={ProseBold} format="woff2" fontWeight="bold" />
<CustomFont
    fontFamily="Conduit Prose"
    url={ProseBoldItalic}
    format="woff2"
    fontWeight="bold"
    fontStyle="italic"
/>

<div
    class="conduit-table"
    aria-busy={gameSession.busy}
    style:--conduit-circuit-board="url({CircuitBoard})"
>
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
    /* The circuit-board theme: a dim board behind everything, cyan for what is live, Conduit Display
       (Audiowide) for names and prompts, Conduit OCR (OCR-A, the emblem letters' face) for the rest,
       Conduit Mono (Share Tech Mono) where OCR-A would crowd, and Conduit Prose (Merriweather), out of
       theme, for the rules. */
    .conduit-table {
        --conduit-bg: #050c18;
        --conduit-panel: rgb(5 13 28 / 0.9);
        --conduit-panel-raised: #0b1d38;
        --conduit-line: #2a5aa0;
        --conduit-ink: #e6f6ff;
        --conduit-muted: #9cc3ee;
        --conduit-accent: #49d6ff;
        --conduit-accent-ink: #021018;
        --conduit-live: #49d6ff;
        --conduit-glow: #1f6fe0;
        --conduit-lcd: #020806;
        --conduit-lcd-line: #1d4a2a;
        --conduit-lcd-ink: #7dffb0;
        --conduit-danger: #f0433a;
        --conduit-paper: #f4f1e8;
        --conduit-paper-ink: #1d2430;
        --conduit-display: 'Conduit Display', 'Segoe UI', sans-serif;
        --conduit-text: 'Conduit OCR', ui-monospace, monospace;
        --conduit-readout: 'Conduit Mono', ui-monospace, monospace;
        --conduit-prose: 'Conduit Prose', Georgia, serif;
        /* Panels lose two corners, like a cut circuit board. */
        --conduit-cut: polygon(
            10px 0,
            100% 0,
            100% calc(100% - 10px),
            calc(100% - 10px) 100%,
            0 100%,
            0 10px
        );
        position: relative;
        isolation: isolate;
        color: var(--conduit-ink);
        background:
            var(--conduit-circuit-board) center / 1600px auto,
            var(--conduit-bg);
        font-family: var(--conduit-text);
    }

    .controls {
        background: var(--conduit-panel);
    }

    .controls.framed {
        clip-path: var(--conduit-cut);
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

    /* The mono, thickened: OCR-A crowds three tabs into the sidebar. */
    .conduit-table :global(.conduit-tab) {
        flex: 1;
        padding: 5px 8px;
        font-family: var(--conduit-readout);
        -webkit-text-stroke: 0.4px currentColor;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--conduit-muted);
        clip-path: var(--conduit-cut);
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
        color: #bff0ff;
        background: #0b2a4f;
        box-shadow:
            inset 0 0 0 1px var(--conduit-accent),
            inset 0 -3px 0 var(--conduit-accent);
    }
</style>
