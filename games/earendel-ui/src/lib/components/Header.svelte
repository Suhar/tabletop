<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
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

    <!-- The planets' colors: their own five, or the five player colors. -->
    <button
        type="button"
        class="mr-2 rounded-md border px-3 py-1 text-xs font-semibold uppercase max-sm:px-2 max-sm:py-0.5
            {gameSession.planetsInPlayerColors
            ? 'border-[#8fb6ff] bg-[#8fb6ff]/20 text-white hover:bg-[#8fb6ff]/30'
            : 'border-white/40 text-white/60 hover:bg-white/10'}"
        aria-pressed={gameSession.planetsInPlayerColors}
        title={gameSession.planetsInPlayerColors
            ? 'Planets are drawn in the five player colors. Click to give them their own colors.'
            : 'Planets are drawn in their own colors. Click to draw them in the five player colors.'}
        onclick={() => gameSession.togglePlanetColors()}
    >
        Planets: {gameSession.planetsInPlayerColors ? 'player colors' : 'own colors'}
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
