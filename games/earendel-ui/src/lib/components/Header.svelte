<script lang="ts">
    import type { ColorScheme } from '$lib/model/colorScheme.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const SCHEMES: Record<ColorScheme, { name: string; title: string }> = {
        classic: {
            name: 'classic',
            title: 'Warm player colors, and planets in five cool colors of their own.'
        },
        shared: {
            name: 'shared',
            title: 'Planets are drawn in the five player colors, so the table shows five colors in all.'
        },
        bold: {
            name: 'bold',
            title: 'Deep, saturated player colors, and soft light planets.'
        }
    }
</script>

<div
    class="flex h-[40px] max-sm:h-[30px] items-center justify-between px-4 max-sm:px-1 text-white uppercase tracking-[0.08em] text-[16px] max-sm:text-[13px]"
>
    <div class="inline-flex gap-x-1">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {/if}
    </div>

    <!-- The game in a handful of cards, while rules help is on. -->
    {#if gameSession.rulesHelpShown}
        <button
            type="button"
            class="ml-auto mr-2 rounded-md border border-[#8fb6ff]/70 px-3 py-1 text-xs font-semibold uppercase text-[#c9dcff] hover:bg-[#8fb6ff]/20 max-sm:px-2 max-sm:py-0.5"
            onclick={() => (gameSession.overviewShown = true)}
        >
            Overview
        </button>
    {/if}

    <!-- The Rules pills beside each decision, for learning the game: on until turned off. -->
    <button
        type="button"
        class="mr-2 rounded-md border px-3 py-1 text-xs font-semibold uppercase max-sm:px-2 max-sm:py-0.5
            {gameSession.rulesHelpShown ? '' : 'ml-auto'}
            {gameSession.rulesHelpShown
            ? 'border-[#8fb6ff] bg-[#8fb6ff]/20 text-white hover:bg-[#8fb6ff]/30'
            : 'border-white/40 text-white/60 hover:bg-white/10'}"
        aria-pressed={gameSession.rulesHelpShown}
        title={gameSession.rulesHelpShown
            ? 'Rules pills are shown beside each decision. Click to hide them.'
            : 'Show a Rules pill beside each decision.'}
        onclick={() => gameSession.toggleRulesHelp()}
    >
        Rules help: {gameSession.rulesHelpShown ? 'on' : 'off'}
    </button>

    <!-- The table's colors: each click moves on to the next of the three schemes. -->
    <button
        type="button"
        class="mr-2 rounded-md border border-white/40 px-3 py-1 text-xs font-semibold uppercase text-white/80 hover:bg-white/10 max-sm:px-2 max-sm:py-0.5"
        title="{SCHEMES[gameSession.colorScheme].title} Click for the next color scheme."
        onclick={() => gameSession.cycleColorScheme()}
    >
        Colors: {SCHEMES[gameSession.colorScheme].name}
    </button>

    {#if gameSession.canUndo}
        <button
            type="button"
            class="rounded-md px-3 py-1 max-sm:px-2 max-sm:py-0.5 text-xs font-semibold uppercase border-2 border-white/70 hover:bg-white/15"
            onclick={() => gameSession.undo()}
        >
            Undo
        </button>
    {/if}
</div>
