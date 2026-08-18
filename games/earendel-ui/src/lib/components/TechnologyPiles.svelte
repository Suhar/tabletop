<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    // Hover opens the spent-technology list; a click pins it open, so it can be read without
    // holding the cursor still on it.
    let hovered = $state(false)
    let pinned = $state(false)
</script>

<!-- Lives in the side column, under the players and history, rather than in the bar above the
     board. It is reference material - how much deck is left, and what has already gone - and the
     bar above the board is where the game asks the player for things. Reference belongs where it
     can be consulted, not where it competes with a prompt. -->
{#if gameSession.discardedTechnologyCount > 0 || gameSession.technologyDeckCount > 0}
    <div
        class="relative px-2 pb-2 text-xs text-white"
        role="group"
        onmouseenter={() => (hovered = true)}
        onmouseleave={() => (hovered = false)}
    >
        <button
            type="button"
            class="w-full rounded-md px-2 py-1 border border-white/25 bg-white/5 hover:bg-white/15 {pinned
                ? 'border-white/60 bg-white/15'
                : ''}"
            onclick={() => (pinned = !pinned)}
        >
            deck {gameSession.technologyDeckCount} · spent {gameSession.discardedTechnologyCount}
        </button>

        {#if hovered || pinned}
            <div
                class="absolute bottom-full left-2 right-2 z-30 mb-1 rounded-lg border border-white/25 bg-[#0d1424]/95 p-2 text-left shadow-xl"
            >
                {#if gameSession.discardedTechnologies.length === 0}
                    <div class="opacity-70">Nothing discarded yet.</div>
                {:else}
                    <div class="mb-1 opacity-70">
                        Spent technologies — reshuffled into the deck when it runs dry.
                    </div>
                    <div class="max-h-[13rem] overflow-auto">
                        {#each gameSession.discardedTechnologies as group (group.name)}
                            <div
                                class="flex items-baseline justify-between gap-2 border-t border-white/10 py-1 first:border-t-0"
                            >
                                <span class="font-semibold">{group.name}</span>
                                <span class="shrink-0 opacity-60">
                                    {group.colors.join(' · ')}
                                    {#if group.count > 1}
                                        <span class="ml-1 opacity-90">×{group.count}</span>
                                    {/if}
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
{/if}
