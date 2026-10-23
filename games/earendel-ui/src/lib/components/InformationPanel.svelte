<script lang="ts">
    import {
        isElevated,
        PieceType,
        technologyAbility,
        technologyName
    } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describePiece } from '$lib/utils/describe.js'
    import { Power } from '$lib/model/stagedSelection.js'

    let gameSession = getGameSession()

    // A card can be the right colour and still be unavailable, when an elevated technology
    // turned up beside it. Saying which of the two it is keeps the rule visible instead of
    // just greying a card out.

    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

    // Hover opens the set-aside cards from this exploration; a click pins them open.
    let setAsideHovered = $state(false)
    let setAsidePinned = $state(false)


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
    <div class="text-center text-sm sm:text-base min-h-[1.5rem]">{gameSession.prompt}</div>

    <!-- Two ways to spend a turn, and they are exclusive: place one of the ships drawn, or play a
         special piece instead. Side by side in one row they read as six interchangeable options,
         which hid both the choice and its price - playing a special sends the WHOLE hand back to
         the bag (reshuffled, so putting ships back tells nobody what is coming). That is a real
         cost and the player should see it before clicking, not discover it afterwards. -->
    <div class="flex flex-wrap items-center justify-center gap-3">
        {#each gameSession.isMyTurn ? gameSession.heldPieces : [] as piece (piece.id)}
            <!-- The hand sits face up before any hex is chosen, which is the whole point of
                 drawing first: the placement is a decision made with knowledge. While a discard
                 is owed, clicking throws that ship out; otherwise clicking picks it up.
                 The unchosen ships were dimmed to 60%, which read as greyed-out-and-unavailable
                 rather than as merely not-selected - they are perfectly playable, and one of them
                 is about to be played. The border is what marks the selection - white on red,
                 dark on the lighter warm colours, matching the text - so the
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
                class="relative flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {gameSession.colors.getPlayerTextColor(
                    piece.playerId
                )} {chosen
                    ? gameSession.colors.getPlayerBorderContrastColor(piece.playerId)
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

    </div>

    {#if gameSession.canPlaySpecial && specials.length > 0}
        <div class="flex flex-wrap items-center justify-center gap-3">
            <!-- The word doing the work. Set between the two groups rather than beside either, so
                 it reads as a fork instead of a label on one side of it. -->
            <span class="text-xs uppercase tracking-widest opacity-60">or</span>

            {#each specials as special (special.id)}
                <button
                    class="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 border-2 {gameSession.colors.getPlayerTextColor(
                        special.playerId
                    )} {gameSession.chosenSpecialId === special.id
                        ? gameSession.colors.getPlayerBorderContrastColor(special.playerId)
                        : 'border-transparent opacity-90'}"
                    style="background-color: {gameSession.colors.getPlayerUiColor(special.playerId)}"
                    onclick={() => gameSession.chooseSpecial(special.id)}
                >
                    <span class="flex items-center gap-2">
                        <span class="text-xl leading-none">{glyph(special)}</span>
                        <span class="text-sm font-semibold">{describePiece(special)}</span>
                    </span>
                    <!-- Named on the button itself. A player is about to hand several ships back
                         for this, and a note elsewhere on the panel is not where they are looking
                         at the moment they decide. -->
                    <span class="text-[10px] leading-none opacity-75">
                        {gameSession.heldPieces.length === 1
                            ? 'returns your drawn ship to the bag'
                            : `returns all ${gameSession.heldPieces.length} drawn ships to the bag`}
                    </span>
                </button>
            {/each}
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

        <!-- What was turned over and set aside reaching this choice: the cards that came up
             without the planet's colour. Behind a button because they are not choices - putting
             them in the row above buried the ones that are - but they are the only sight a player
             gets of what has just left the deck. -->
        {#if gameSession.setAsideCards.length > 0}
            <div
                class="relative text-xs"
                role="group"
                onmouseenter={() => (setAsideHovered = true)}
                onmouseleave={() => (setAsideHovered = false)}
            >
                <button
                    type="button"
                    class="rounded-md px-2 py-1 border border-white/25 bg-white/5 hover:bg-white/15 {setAsidePinned
                        ? 'border-white/60 bg-white/15'
                        : ''}"
                    onclick={() => (setAsidePinned = !setAsidePinned)}
                >
                    {gameSession.setAsideCards.length} set aside
                </button>

                {#if setAsideHovered || setAsidePinned}
                    <div
                        class="absolute left-1/2 top-full z-30 mt-1 w-[19rem] -translate-x-1/2 rounded-lg border border-white/25 bg-[#0d1424]/95 p-2 text-left shadow-xl"
                    >
                        <div class="mb-1 opacity-70">
                            Turned over without this planet's colour, and discarded.
                        </div>
                        {#each gameSession.setAsideCards as card (card.id)}
                            <div class="border-t border-white/10 py-1 first:border-t-0">
                                <div class="flex items-baseline justify-between gap-2">
                                    <span class="font-semibold">{technologyName(card)}</span>
                                    <span class="shrink-0 opacity-60">{card.colors.join(' · ')}</span>
                                </div>
                                <div class="opacity-70">{technologyAbility(card)}</div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
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
         click sends it. -->
    {#if gameSession.canUseUpdatedLogistics}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.choosingUpdatedLogistics
                ? 'bg-sky-400/30 border-sky-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.choosePower(Power.Logistics)}
        >
            {gameSession.choosingUpdatedLogistics
                ? 'Choose a fighter to attack with'
                : 'Updated Logistics'}
        </button>
    {/if}

    <!-- Tactical Feint: two clicks on the board rather than one, since a swap has two ends. The
         button only asks for the first; the board narrows to that ship's enemy neighbours once it
         is picked. -->
    {#if gameSession.canUseTacticalFeint}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.choosingFeint
                ? 'bg-violet-400/30 border-violet-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.choosePower(Power.Feint)}
        >
            {#if !gameSession.choosingFeint}
                Tactical Feint
            {:else if gameSession.feintFrom}
                Choose the enemy ship to swap with
            {:else}
                Choose one of your ships
            {/if}
        </button>
    {/if}

    <!-- Immediate Download: both ends are planets, not ships. Only offered when some Download
         planet of theirs can actually see a technology worth taking, since it is a one-shot and
         there is no getting it back. -->
    {#if gameSession.canUseImmediateDownload}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.choosingDownload
                ? 'bg-emerald-400/30 border-emerald-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.choosePower(Power.Download)}
        >
            {#if !gameSession.choosingDownload}
                Immediate Download
            {:else if gameSession.downloadFrom}
                Choose a planet in sight
            {:else}
                Choose your Download planet
            {/if}
        </button>
    {/if}

    <!-- Trade Route Wormhole: pick the traveller, then where it comes out. The board narrows to
         that ship's own routes once it is picked, so the colour rule never has to be explained. -->
    {#if gameSession.canUseTradeRouteWormhole}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.choosingWormhole
                ? 'bg-teal-400/30 border-teal-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.choosePower(Power.Wormhole)}
        >
            {#if !gameSession.choosingWormhole}
                Trade Route Wormhole
            {:else if gameSession.wormholeFrom}
                Choose where it comes out
            {:else}
                Choose a ship to send
            {/if}
        </button>
    {/if}

    <!-- Full Torpedo Spread: arm it, click the neighbours to include, then fire. A confirm step
         rather than firing on click, because "any or all" makes this a subset being assembled -
         and unlike every other attack in the game, a click here is not the decision. -->
    {#if gameSession.canSpread}
        <div class="flex items-center gap-2">
            <button
                class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.spreading
                    ? 'bg-orange-400/30 border-orange-300'
                    : 'bg-white/15 hover:bg-white/25 border-white/70'}"
                onclick={() => gameSession.choosePower(Power.Spread)}
            >
                Full Torpedo Spread
            </button>

            {#if gameSession.spreading}
                <button
                    disabled={!gameSession.canConfirmSpread}
                    class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.canConfirmSpread
                        ? 'bg-orange-400/30 border-orange-300 hover:bg-orange-400/40'
                        : 'border-white/25 bg-white/5 opacity-50 cursor-default'}"
                    onclick={() => gameSession.confirmSpread()}
                >
                    Fire at {gameSession.spreadTargets.length}
                </button>
            {/if}
        </div>
    {/if}

    {#if gameSession.canArmRailgun}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold border-2 {gameSession.railgunArmed
                ? 'bg-red-400/30 border-red-300'
                : 'bg-white/15 hover:bg-white/25 border-white/70'}"
            onclick={() => gameSession.choosePower(Power.Railgun)}
        >
            {gameSession.railgunArmed ? 'Railgun armed' : 'Arm Railgun'}
        </button>
    {/if}

    {#if gameSession.choosablePlanets.length > 0}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
            onclick={() => gameSession.skipSurvey()}
        >
            Don't survey
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
