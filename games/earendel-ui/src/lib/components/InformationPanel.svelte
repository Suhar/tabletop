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

    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

    let setAsideHovered = $state(false)
    let setAsidePinned = $state(false)


    const SHAPE: Record<string, string> = {
        [PieceType.Probe]: '◎',
        [PieceType.Station]: '▢',
        [PieceType.Fighter]: '▲'
    }

    const glyph = (piece: { type: string; hub?: boolean }) =>
        piece.hub ? '▣' : (SHAPE[piece.type] ?? '?')
</script>

<div class="flex flex-col items-center gap-2 py-2 text-white">
    <div class="text-center text-sm sm:text-base min-h-[1.5rem]">{gameSession.prompt}</div>

    <div class="flex flex-wrap items-center justify-center gap-3">
        {#each gameSession.isMyTurn ? gameSession.heldPieces : [] as piece (piece.id)}
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
        <!-- Rotating is worth offering even when the outline repeats: the planet swaps corners. -->
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

    {#if gameSession.canEndTurn}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
            onclick={() => gameSession.endTurn()}
        >
            End turn
        </button>
    {/if}

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
