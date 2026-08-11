<script lang="ts">
    import { isElevated, matchesColor, PieceType } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describePiece } from '$lib/model/session.svelte.js'

    let gameSession = getGameSession()

    // A card can be the right colour and still be unavailable, when an elevated technology
    // turned up beside it. Saying which of the two it is keeps the rule visible instead of
    // just greying a card out.
    let planetColor = $derived(gameSession.exploringPlanetColor)
    let anyElevated = $derived(gameSession.technologyChoices.some(isElevated))

    let drawn = $derived(gameSession.drawnPiece)
    let specials = $derived(gameSession.myPlayerState?.specialPieces ?? [])

    const SHAPE: Record<string, string> = {
        [PieceType.Probe]: '◎',
        [PieceType.Station]: '▢',
        [PieceType.Fighter]: '▲'
    }
</script>

<div class="flex flex-col items-center gap-2 py-2 text-white">
    <div class="text-center text-sm sm:text-base min-h-[1.5rem]">{gameSession.prompt}</div>

    <div class="flex flex-wrap items-center justify-center gap-3">
        {#if drawn && gameSession.isMyTurn}
            <!-- The draw sits face up before any hex is chosen, which is the whole point of
                 drawing first: the placement is a decision made with knowledge. -->
            <div
                class="flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {gameSession.chosenSpecialId
                    ? 'border-transparent opacity-50'
                    : 'border-white'}"
                style="background-color: {gameSession.colors.getPlayerUiColor(drawn.playerId)}"
            >
                <span class="text-xl leading-none">{SHAPE[drawn.type]}</span>
                <span class="text-sm font-semibold">You drew: {describePiece(drawn)}</span>
            </div>
        {/if}

        {#each gameSession.canPlaySpecial ? specials : [] as special (special.id)}
            <button
                class="flex items-center gap-2 rounded-lg px-3 py-1.5 border-2 {gameSession.chosenSpecialId ===
                special.id
                    ? 'border-white'
                    : 'border-transparent opacity-70'}"
                style="background-color: {gameSession.colors.getPlayerUiColor(special.playerId)}"
                onclick={() => gameSession.toggleSpecial(special.id)}
            >
                <span class="text-xl leading-none">{SHAPE[special.type]}</span>
                <span class="text-sm font-semibold">Special: {describePiece(special)}</span>
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
                        {card.id.replace('tech-', 'Tech ')}{isElevated(card) ? ' ★' : ''}
                    </div>
                    <div class="text-xs opacity-80">{card.colors.join(' · ')}</div>
                    {#if outranked}
                        <div class="text-[11px] opacity-70">outranked</div>
                    {/if}
                </button>
            {/each}
        </div>
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

    {#if gameSession.attackTargets.length > 0}
        <button
            class="rounded-md px-4 py-1.5 text-sm font-semibold bg-white/15 hover:bg-white/25 border-2 border-white/70"
            onclick={() => gameSession.holdFire()}
        >
            Hold fire
        </button>
    {/if}
</div>
