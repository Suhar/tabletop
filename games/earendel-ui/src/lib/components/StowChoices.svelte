<script lang="ts">
    import { onMount } from 'svelte'
    import { gsap } from 'gsap'
    import type { GameAction } from '@tabletop/common'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import { isStowShip, type StowChoice } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describePiece } from '$lib/utils/describe.js'
    import ShipCard from './ShipCard.svelte'

    // The opening's choice of a ship to stow. When live play brings the cards (the board just
    // built, or the player before finishing their opening) they fade in one at a time face down,
    // then turn over from left to right: local presentation, owned here, since the cards
    // arriving explain no transition and only this component's own buttons wait on them. Cards
    // that come back by undo, on leaving history or on reload are face up and ready at once. The
    // choice itself is a committed action, so what follows it (the other two fade, the chosen
    // card twirls and fades) goes on the shared timeline, before the state moves on.
    const gameSession = getGameSession()

    const BEAT = 0.35
    const FADE = 0.35
    const FADE_GAP = 0.22
    const FLIP = 0.5
    const FLIP_GAP = 0.16
    const FLIP_LIFT = 12
    const REJECT_FADE = 0.3
    const TWIRL = 0.9
    const TWIRL_LIFT = 16
    const CHOSEN_FADE = 0.35

    let cards: HTMLElement[] = $state([])
    // The cards cannot be chosen until they have turned face up, nor once one has been.
    let revealed = $state(false)
    let chosen: StowChoice | undefined = $state()

    // The cards' leaf planes fade, never their wrappers: opacity flattens 3D children.
    const layersOf = (card: HTMLElement) => [
        ...card.querySelectorAll<HTMLElement>('[data-card-layer]')
    ]

    function choose(choice: StowChoice) {
        if (!revealed || chosen) return
        chosen = choice
        void gameSession.stowShip(choice)
    }

    // Only the stowing player is sent the choice, and only they have these cards, so nobody
    // else sees which ship went in. Undo and history bring the cards back by mounting them.
    async function onStowed({
        action,
        animationContext
    }: {
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!isStowShip(action) || action.choice === undefined) return
        const picked = gameSession.stowableShips.findIndex((ship) => ship.choice === action.choice)
        const card = cards[picked]
        if (!card) return

        const timeline = animationContext.actionTimeline
        const others = cards.filter((other, index) => other && index !== picked)
        timeline.to(
            others.flatMap(layersOf),
            { opacity: 0, duration: REJECT_FADE, ease: 'power1.in' },
            0
        )
        timeline.to(card, { rotationY: 360, duration: TWIRL, ease: 'power2.inOut' }, REJECT_FADE)
        timeline.to(
            card,
            {
                keyframes: [
                    { y: -TWIRL_LIFT, duration: TWIRL * 0.4, ease: 'power1.out' },
                    { y: 0, duration: TWIRL * 0.6, ease: 'power1.in' }
                ]
            },
            REJECT_FADE
        )
        timeline.to(
            layersOf(card),
            { opacity: 0, duration: CHOSEN_FADE, ease: 'power1.in' },
            REJECT_FADE + TWIRL
        )
    }

    onMount(() => {
        gameSession.addGameStateChangeListener(onStowed)
        const unlisten = () => gameSession.removeGameStateChangeListener(onStowed)

        const shown = cards.filter(Boolean)
        const arrivingLive = gameSession.takeStowReveal()
        if (
            !arrivingLive ||
            shown.length === 0 ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            revealed = true
            return unlisten
        }

        const layers = shown.map(layersOf)
        gsap.set(shown, { rotationY: 180 })
        gsap.set(layers.flat(), { opacity: 0 })

        const turning = BEAT + (shown.length - 1) * FADE_GAP + FADE + BEAT
        const timeline = gsap.timeline({
            onComplete: () => {
                gsap.set(shown, { clearProps: 'transform' })
                revealed = true
            }
        })
        shown.forEach((card, index) => {
            timeline.to(
                layers[index],
                { opacity: 1, duration: FADE, ease: 'power1.out' },
                BEAT + index * FADE_GAP
            )
            const at = turning + index * FLIP_GAP
            timeline.to(card, { rotationY: 0, duration: FLIP, ease: 'power2.inOut' }, at)
            timeline.to(
                card,
                {
                    keyframes: [
                        { y: -FLIP_LIFT, duration: FLIP * 0.4, ease: 'power1.out' },
                        { y: 0, duration: FLIP * 0.6, ease: 'power1.in' }
                    ]
                },
                at
            )
        })

        return () => {
            unlisten()
            timeline.kill()
        }
    })
</script>

<div
    class="flex min-h-[104px] flex-wrap items-center justify-center gap-3"
    style="perspective: 900px"
>
    {#each gameSession.stowableShips as { choice, piece }, index (choice)}
        <div bind:this={cards[index]} class="relative" style="transform-style: preserve-3d">
            <button
                type="button"
                disabled={!revealed || chosen !== undefined}
                class="relative rounded-lg transition-transform enabled:hover:-translate-y-1"
                style="transform-style: preserve-3d"
                title="Stow a {describePiece(piece)}"
                onclick={() => choose(choice)}
            >
                <ShipCard {piece} flippable />
            </button>
        </div>
    {/each}
</div>
