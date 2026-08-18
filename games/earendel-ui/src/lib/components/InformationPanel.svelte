<script lang="ts">
    import {
        isElevated,
        PieceType,
        technologyAbility,
        technologyName
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describePiece } from '$lib/model/session.svelte.js'

    let gameSession = getGameSession()

    // A card can be the right colour and still be unavailable, when an elevated technology
    // turned up beside it. Saying which of the two it is keeps the rule visible instead of
    // just greying a card out.

    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

    // Hover opens the spent-technology list; a click pins it open, so it can be read without
    // holding the cursor still on it.
    let discardHovered = $state(false)
    let discardPinned = $state(false)

    const SHAPE: Record<string, string> = {
        [PieceType.Probe]: '◎',
        [PieceType.Station]: '▢',
        [PieceType.Fighter]: '▲'
    }

    // A hub is a station with a ring around it on the board, and a nested square here.
    const glyph = (piece: { type: string; hub?: boolean }) =>
        piece.hub ? '▣' : (SHAPE[piece.type] ?? '?')
</script>

<div class="flex flex-col items-center gap-2 py-2 text-white">
    <div class="flex items-center gap-3">
        <div class="text-center text-sm sm:text-base min-h-[1.5rem]">{gameSession.prompt}</div>
        {#if gameSession.undoableAction}
            <!-- Only shown when there is something to take back. The platform decides that:
                 undo cannot reach past an action that revealed anything. -->
            <button
                class="rounded-md px-3 py-1 text-xs font-semibold uppercase bg-transparent border-2 border-white/70 hover:bg-white/15"
                onclick={() => gameSession.undoLastAction()}
            >
                Undo
            </button>
        {/if}
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
        {#each gameSession.isMyTurn ? gameSession.heldPieces : [] as piece (piece.id)}
            <!-- The hand sits face up before any hex is chosen, which is the whole point of
                 drawing first: the placement is a decision made with knowledge. While a discard
                 is owed, clicking throws that ship out; otherwise clicking picks it up.
                 The unchosen ships were dimmed to 60%, which read as greyed-out-and-unavailable
                 rather than as merely not-selected - they are perfectly playable, and one of them
                 is about to be played. The white border is what marks the selection, so the
                 dimming only has to be a whisper. A ship with nowhere legal to go stays visibly
                 struck out, since that one genuinely cannot be used.
                 While a discard is owed, hovering a ship greys it out - a preview of what it
                 will look like once it is gone. A red cross was tried here first and read as a
                 warning about a mistake, where this reads as the outcome itself, which is what
                 the player is actually choosing between. -->
            {@const chosen = gameSession.drawnPiece?.id === piece.id
                && !gameSession.chosenSpecialId}
            {@const stuck = !gameSession.isDiscarding && !gameSession.canPlaceHeld(piece)}
            <button
                disabled={stuck && !gameSession.isDiscarding}
                title={stuck ? 'Nowhere legal for this ship to go' : ''}
                class="relative flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {chosen
                    ? 'border-white'
                    : 'border-transparent opacity-90'} {stuck
                    ? 'line-through opacity-55'
                    : ''} {gameSession.isDiscarding ? 'discardable' : ''}"
                style="background-color: {gameSession.colors.getPlayerUiColor(piece.playerId)}"
                onclick={() =>
                    gameSession.isDiscarding
                        ? gameSession.discard(piece.id)
                        : gameSession.chooseHeld(piece.id)}
            >
                <span class="text-xl leading-none">{glyph(piece)}</span>
                <span class="text-sm font-semibold">
                    {gameSession.isDiscarding ? 'Discard' : ''}
                    {describePiece(piece)}
                </span>
            </button>
        {/each}

        {#each gameSession.canPlaySpecial ? specials : [] as special (special.id)}
            <button
                class="flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {gameSession.chosenSpecialId ===
                special.id
                    ? 'border-white'
                    : 'border-transparent opacity-90'}"
                style="background-color: {gameSession.colors.getPlayerUiColor(special.playerId)}"
                onclick={() => gameSession.toggleSpecial(special.id)}
            >
                <span class="text-xl leading-none">{glyph(special)}</span>
                <span class="text-sm font-semibold">{describePiece(special)}</span>
            </button>
        {/each}
    </div>

    <!-- The spent technologies, and how much deck is left. Collapsed to two counts until asked
         about: it is reference material, not something in the way of a turn. Hovering opens it,
         and clicking pins it so a player can read it without holding the mouse still.
         Grouped by effect rather than listed card by card - see discardedTechnologies. -->
    {#if gameSession.discardedTechnologyCount > 0 || gameSession.technologyDeckCount > 0}
        <div
            class="relative text-xs"
            role="group"
            onmouseenter={() => (discardHovered = true)}
            onmouseleave={() => (discardHovered = false)}
        >
            <button
                type="button"
                class="rounded-md px-2 py-1 border border-white/25 bg-white/5 hover:bg-white/15 {discardPinned
                    ? 'border-white/60 bg-white/15'
                    : ''}"
                onclick={() => (discardPinned = !discardPinned)}
            >
                deck {gameSession.technologyDeckCount} · spent {gameSession.discardedTechnologyCount}
            </button>

            {#if discardHovered || discardPinned}
                <div
                    class="absolute left-1/2 top-full z-30 mt-1 w-[19rem] -translate-x-1/2 rounded-lg border border-white/25 bg-[#0d1424]/95 p-2 text-left shadow-xl"
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

    {#if gameSession.technologyChoices.length > 0}
        <!-- Only what can actually be taken. Every card turned over on the way used to be shown
             too, greyed out and labelled with why it missed, so the flip read as a moment rather
             than a result - but it made the choice hard to find inside a row of things that
             weren't choices, and the misses are recorded in history anyway. -->
        <div class="flex flex-wrap items-center justify-center gap-2">
            {#each gameSession.technologyChoices as card (card.id)}
                <button
                    class="rounded-md px-3 py-2 text-sm border-2 cursor-pointer {isElevated(card)
                        ? 'border-amber-300 bg-amber-300/20 hover:bg-amber-300/30'
                        : 'border-white bg-white/15 hover:bg-white/25'}"
                    onclick={() => gameSession.chooseTechnology(card.id)}
                >
                    <div class="font-semibold">
                        {technologyName(card)}{isElevated(card) ? ' ★' : ''}
                    </div>
                    <div class="text-[11px] opacity-80 max-w-[16rem]">
                        {technologyAbility(card)}
                    </div>
                    <div class="text-[11px] opacity-60">{card.colors.join(' · ')}</div>
                </button>
            {/each}
        </div>
    {/if}

    {#if gameSession.canDraw}
        <!-- The turn waits here rather than drawing on its own, so that nothing is revealed
             until this player asks - and the player before them still has time to undo. -->
        <button
            class="rounded-md px-5 py-2 text-sm font-semibold bg-white/20 hover:bg-white/30 border-2 border-white"
            onclick={() => gameSession.drawPieces()}
        >
            Draw {gameSession.drawCount}
            {gameSession.drawCount === 1 ? 'ship' : 'ships'}
        </button>
    {/if}

    {#if gameSession.canUseLogisticsUpgrade}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-amber-300/20 hover:bg-amber-300/30 border-2 border-amber-300"
            onclick={() => gameSession.useLogisticsUpgrade()}
        >
            Spend Logistics Upgrade — keep all three
        </button>
    {/if}

    {#if gameSession.isPlacingTile}
        <!-- Turning the tile is worth offering even when the outline doesn't move: the shape
             repeats every half turn but the planet swaps corners. -->
        <div class="flex items-center gap-2">
            <button
                class="rounded-md px-3 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.rotateTile(-1)}
            >
                ⟲ Rotate
            </button>
            <span class="text-xs opacity-75">turn {gameSession.tileRotation + 1} of 6</span>
            <button
                class="rounded-md px-3 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
                onclick={() => gameSession.rotateTile(1)}
            >
                Rotate ⟳
            </button>
        </div>
    {/if}

    <!-- Updated Logistics wakes a fighter that has already landed. Pressing this asks which
         one; the board then highlights the fighters that actually have something in reach, and a
         click sends it. Pressing again backs out, since nothing has been committed yet. -->
    {#if gameSession.canUseUpdatedLogistics}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.choosingUpdatedLogistics
                ? 'bg-sky-400/30 border-sky-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.toggleUpdatedLogistics()}
        >
            {gameSession.choosingUpdatedLogistics
                ? 'Choose a fighter to attack with'
                : 'Updated Logistics'}
        </button>
    {/if}

    {#if gameSession.canArmRailgun}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.railgunArmed
                ? 'bg-red-400/30 border-red-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.toggleRailgun()}
        >
            {gameSession.railgunArmed ? 'Railgun armed' : 'Arm Railgun'}
        </button>
    {/if}

    {#if gameSession.attackTargets.length > 0}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
            onclick={() => gameSession.holdFire()}
        >
            Hold fire
        </button>
    {/if}

    {#if gameSession.isMovingForTechnology}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
            onclick={() => gameSession.holdPosition()}
        >
            Hold position
        </button>
    {/if}
</div>

<style>
    /* While a discard is owed, the hovered ship fades toward the background and loses its
       colour - showing the player the result rather than warning them about it. */
    .discardable {
        transition:
            opacity 120ms ease-out,
            filter 120ms ease-out;
    }

    .discardable:hover,
    .discardable:focus-visible {
        opacity: 0.3;
        filter: grayscale(1);
    }

</style>
