<script lang="ts">
    import { onMount } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { isUseAsteroidField, type StowChoice } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { animateCardChoice } from '$lib/utils/cardChoice.js'
    import { describePiece } from '$lib/utils/describe.js'
    import ShipCard from './ShipCard.svelte'

    // An Asteroid Field's three ships to choose from, as the cards they would be. The choice is
    // a committed action, so what follows it (the other two fade, the chosen card twirls and
    // fades, as the opening's stowed ship does) goes on the shared timeline, before the state
    // moves on. Only the player choosing is sent the choice, and only they have these cards.
    const gameSession = getGameSession()

    let cards: HTMLElement[] = $state([])
    let chosen: StowChoice | undefined = $state()

    function choose(choice: StowChoice) {
        if (chosen) return
        chosen = choice
        void gameSession.useAsteroidField(choice)
    }

    async function onBuilt({
        action,
        animationContext
    }: {
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!isUseAsteroidField(action) || action.choice === undefined) return
        const picked = gameSession.asteroidShips.findIndex((ship) => ship.choice === action.choice)
        animateCardChoice(animationContext.actionTimeline, cards, picked)
    }

    onMount(() => {
        gameSession.addGameStateChangeListener(onBuilt)
        return () => gameSession.removeGameStateChangeListener(onBuilt)
    })
</script>

<div class="flex flex-wrap items-center justify-center gap-2" style="perspective: 900px">
    {#each gameSession.asteroidShips as { choice, piece }, index (choice)}
        <div bind:this={cards[index]} class="relative" style="transform-style: preserve-3d">
            <button
                type="button"
                disabled={chosen !== undefined}
                class="relative rounded-lg transition-transform enabled:hover:-translate-y-1"
                style="transform-style: preserve-3d"
                aria-label="Build three: {describePiece(piece)}"
                onclick={() => choose(choice)}
            >
                <ShipCard {piece} flippable />
            </button>
        </div>
    {/each}
</div>
