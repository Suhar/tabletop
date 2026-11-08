<script lang="ts">
    import { Harness, type GameUiDefinition } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { TwoCrownsDesign } from '@tabletop/two-crowns'
    import { UiDefinition } from '../lib/index.js'
    import BotTools from './bots/BotTools.svelte'
    import '../app.css'
    const definition = UiDefinition as unknown as GameUiDefinition<GameState, HydratedGameState>
    const design = `design ${TwoCrownsDesign.version}${TwoCrownsDesign.dirty ? ', modified' : ''}`
</script>

<svelte:head><title>The Two Crowns 1874 — Development ({design})</title></svelte:head>

<Harness {definition}>
    {#snippet tools(harness)}
        <BotTools {harness} />
    {/snippet}
</Harness>
