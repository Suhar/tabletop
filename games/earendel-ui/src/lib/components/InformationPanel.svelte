<script lang="ts">
    import {
        isElevated,
        matchesColor,
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
    let planetColor = $derived(gameSession.exploringPlanetColor)
    let anyElevated = $derived(gameSession.technologyChoices.some(isElevated))

    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

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
                 is owed, clicking throws that ship out; otherwise clicking picks it up. -->
            {@const chosen = gameSession.drawnPiece?.id === piece.id
                && !gameSession.chosenSpecialId}
            {@const stuck = !gameSession.isDiscarding && !gameSession.canPlaceHeld(piece)}
            <button
                disabled={stuck && !gameSession.isDiscarding}
                title={stuck ? 'Nowhere legal for this ship to go' : ''}
                class="flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {chosen
                    ? 'border-white'
                    : 'border-transparent opacity-60'} {stuck ? 'line-through opacity-40' : ''}"
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
                    : 'border-transparent opacity-70'}"
                style="background-color: {gameSession.colors.getPlayerUiColor(special.playerId)}"
                onclick={() => gameSession.toggleSpecial(special.id)}
            >
                <span class="text-xl leading-none">{glyph(special)}</span>
                <span class="text-sm font-semibold">{describePiece(special)}</span>
            </button>
        {/each}
    </div>

    {#if gameSession.technologyChoices.length > 0}
        <!-- Everything turned over is shown, but only the matching cards can be taken - the
             misses are there so the flip reads as a moment rather than a result. -->
        <div class="flex flex-wrap items-center justify-center gap-2">
            {#each gameSession.revealedCards as card (card.id)}
                {@const choosable = gameSession.technologyChoices.some(
                    (candidate) => candidate.id === card.id
                )}
                {@const outranked =
                    !choosable && anyElevated && planetColor && matchesColor(card, planetColor)}
                <button
                    disabled={!choosable}
                    title={choosable
                        ? ''
                        : outranked
                          ? 'An elevated technology was revealed, so this cannot be taken'
                          : 'Not this planet’s colour'}
                    class="rounded-md px-3 py-2 text-sm border-2 {choosable
                        ? isElevated(card)
                            ? 'border-amber-300 bg-amber-300/20 hover:bg-amber-300/30 cursor-pointer'
                            : 'border-white bg-white/15 hover:bg-white/25 cursor-pointer'
                        : 'border-white/20 bg-white/5 opacity-45 cursor-default'}"
                    onclick={() => choosable && gameSession.chooseTechnology(card.id)}
                >
                    <div class="font-semibold">
                        {technologyName(card)}{isElevated(card) ? ' ★' : ''}
                    </div>
                    <div class="text-[11px] opacity-80 max-w-[16rem]">
                        {technologyAbility(card)}
                    </div>
                    <div class="text-[11px] opacity-60">{card.colors.join(' · ')}</div>
                    {#if outranked}
                        <div class="text-[11px] opacity-70">outranked</div>
                    {/if}
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
