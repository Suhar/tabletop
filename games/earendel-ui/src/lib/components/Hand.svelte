<script lang="ts">
    import type { Snippet } from 'svelte'
    import { MachineState, PieceType } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { getHandAnimator } from '$lib/model/handAnimatorContext.js'
    import { registerElement } from '$lib/animators/elementRegistry.js'
    import { flipCard } from '$lib/animators/handAnimator.svelte.js'
    import Bag from './Bag.svelte'
    import ShipCard from './ShipCard.svelte'

    // The acting player's bag and hand: the bag until the turn's draw, the deal, then the turn's
    // ships as cards, each turning face down as it leaves the hand. Shown live for the player
    // whose turn it is, and in history for whoever's turn is being looked at.
    let {
        cards,
        interactive,
        beside,
        side,
        sideShown = false,
        specials,
        specialsShown = false
    }: {
        // Whether the ships themselves are shown; the bag shows regardless.
        cards: boolean
        // Whether the cards may be clicked to throw one out or choose one to place.
        interactive: boolean
        // What stands beside the bag until the deal, such as the prompt to click it.
        beside?: Snippet
        // Whatever else the turn offers (notes, choices, powers, buttons), in a column beside the
        // cards, so that nothing is stacked on them and pushes them out of the bar.
        side?: Snippet
        sideShown?: boolean
        // The special pieces the player could play instead of the draw, as cards after the hand.
        specials?: Snippet
        specialsShown?: boolean
    } = $props()

    const gameSession = getGameSession()
    const handAnimator = getHandAnimator()

    let bagShown = $derived(gameSession.gameState.machineState === MachineState.StartOfTurn)
    let dealing = $derived(handAnimator.dealing?.pieces ?? [])
    let shown = $derived(
        bagShown || dealing.length > 0 || (cards && gameSession.turnHand.some((card) => card.held))
    )
    let column = $derived(side !== undefined && sideShown)
    let specialsOpen = $derived(
        specials !== undefined && specialsShown && !bagShown && dealing.length === 0
    )

    // The bag is what the player must click to begin: when it appears on their turn, whatever
    // scrolls is brought far enough to show the whole of it. Nothing happens if it already is.
    function showWhole(node: HTMLElement, mine: boolean) {
        if (mine) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    // The side column and the special pieces open out from nothing, so the cards beside them
    // slide over to make room, and close up again when they go: a transition on their own width,
    // local presentation that nothing in the game waits on. The cards' wrappers are the hand
    // animator's alone to move.
</script>

{#if shown}
    <div class="flex flex-wrap items-center justify-center gap-y-2">
        {#if bagShown}
            <div
                use:registerElement={{ registry: handAnimator.bag, key: 'bag' }}
                use:showWhole={interactive}
                class="mr-4 flex w-[90px] shrink-0 overflow-x-clip"
            >
                <Bag />
            </div>
        {/if}
        <!-- The perspective the cards turn in sits on the cards alone: on the whole row it would
             capture the fixed popups of the technology chips beside them. It is dropped while
             the bag's prompt stands here instead of cards, for the popup of its Rules pill. -->
        <div
            class="flex min-h-[104px] min-w-[222px] flex-wrap items-center gap-3"
            style={bagShown && dealing.length === 0 ? '' : 'perspective: 900px'}
        >
            {#if dealing.length > 0}
                {#each dealing as piece (piece.id)}
                    <div
                        use:registerElement={{ registry: handAnimator.cards, key: piece.id }}
                        data-piece={piece.id}
                        class="relative"
                        style="transform-style: preserve-3d"
                    >
                        <ShipCard {piece} flippable back={false} />
                    </div>
                {/each}
            {:else if bagShown}
                <!-- No wider than the three cards that replace it: a wider prompt would shrink
                     the row when it goes, and the bag would slide over as the row re-centered. -->
                {#if beside && !handAnimator.promptHidden}
                    <div class="w-[222px]">{@render beside()}</div>
                {/if}
            {:else}
                {#each gameSession.turnHand as card (card.piece.id)}
                    {@const piece = card.piece}
                    {@const chosen =
                        interactive &&
                        card.held &&
                        gameSession.drawnPiece?.id === piece.id &&
                        !gameSession.chosenSpecialId}
                    {@const scrap = piece.type === PieceType.Scrap}
                    {@const stuck =
                        interactive &&
                        card.held &&
                        !scrap &&
                        !gameSession.isDiscarding &&
                        !gameSession.canPlaceHeld(piece)}
                    <!-- The wrapper is the animator's to turn; the state sets its resting angle through flipCard. -->
                    <div
                        use:flipCard={{
                            animator: handAnimator,
                            pieceId: piece.id,
                            faceDown: !card.held
                        }}
                        data-piece={piece.id}
                        class="relative"
                        style="transform-style: preserve-3d"
                    >
                        <button
                            type="button"
                            disabled={!interactive || stuck || !card.held}
                            title={stuck
                                ? 'Nowhere legal for this ship to go'
                                : scrap && interactive && card.held && !gameSession.isDiscarding
                                  ? 'Play the Scrap: it does nothing, but it is out of your bag'
                                  : ''}
                            class="relative rounded-lg transition-transform enabled:hover:-translate-y-1 {stuck
                                ? 'line-through'
                                : ''}"
                            style="transform-style: preserve-3d"
                            onclick={() =>
                                gameSession.isDiscarding
                                    ? gameSession.discard(piece.id)
                                    : scrap
                                      ? gameSession.playScrap(piece.id)
                                      : gameSession.chooseHeld(piece.id)}
                        >
                            <ShipCard {piece} selected={chosen} dimmed={stuck} flippable />
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
        <!-- The special pieces that could be played instead, on the cards' level. -->
        <div class="opening {specialsOpen ? 'open' : ''}">
            <div>
                {#if specialsOpen && specials}
                    <div class="flex w-max items-center gap-3 pl-3">
                        <span class="text-xs uppercase tracking-widest opacity-60">or</span>
                        {@render specials()}
                    </div>
                {/if}
            </div>
        </div>
        <div class="opening {column ? 'open' : ''}">
            <div>
                {#if column && side}
                    <!-- Padded on both sides so the track's clip does not cut a chip's edge or
                         the glow of one being played. Its full width from the start, clipped by the opening track: sized to
                         the track instead, its text would wrap while the track is narrow, make
                         the row taller, and dip the cards on their way across. -->
                    <div
                        class="flex w-max max-w-[26rem] flex-col items-start justify-center gap-1.5 pl-5 pr-5"
                    >
                        {@render side()}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .opening {
        display: grid;
        grid-template-columns: 0fr;
        opacity: 0;
        transition:
            grid-template-columns 350ms ease-out,
            opacity 300ms ease-out;
    }

    .opening.open {
        grid-template-columns: 1fr;
        opacity: 1;
        transition:
            grid-template-columns 350ms ease-out,
            opacity 300ms ease-out 200ms;
    }

    /* Clipped across only: a card lifting on hover, or its glow, may still rise above the row. */
    .opening > div {
        min-width: 0;
        overflow-x: clip;
    }

    @media (prefers-reduced-motion: reduce) {
        .opening,
        .opening.open {
            transition: none;
        }
    }
</style>
