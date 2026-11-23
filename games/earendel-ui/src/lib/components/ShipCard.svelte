<script lang="ts">
    import { type Piece, PieceType } from '@tabletop/earendel'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { fighterSilhouetteFor } from '$lib/utils/fighterShapes.js'
    import { SHIP_CARD_FRAME } from '$lib/utils/shipCard.js'
    import { describePiece } from '$lib/utils/describe.js'
    import FighterShape from './FighterShape.svelte'
    import ProbeShape from './ProbeShape.svelte'
    import StationShape from './StationShape.svelte'
    import UnitGlyph from './UnitGlyph.svelte'
    import CardBack from './CardBack.svelte'

    // A ship in hand, as a card with the bag's outline: the ship in its owner's color, its name
    // and its level.
    let {
        piece,
        selected = false,
        dimmed = false,
        flippable = false,
        back = true
    }: {
        piece: Piece
        selected?: boolean
        dimmed?: boolean
        // Carries a back, for a card that turns over as it is dealt or when it leaves the hand.
        // The card never turns itself: whoever wraps it owns the whole turn, so no two layers
        // ever swap angles in one frame.
        flippable?: boolean
        // A ship dealt from the bag turns with no back: it is unseen until its face comes round.
        back?: boolean
    } = $props()

    const gameSession = getGameSession()
    let tint = $derived(gameSession.colors.getPlayerUiColor(piece.playerId))
    let textClass = $derived(gameSession.colors.getPlayerTextColor(piece.playerId))
    let ink = $derived(gameSession.colors.getPlayerTextColorValue(piece.playerId))
    let silhouette = $derived(
        fighterSilhouetteFor(gameSession.colors.getPlayerColor(piece.playerId))
    )
    const center = { x: 0, y: 0 }
    // The ships fit a radius of 26; the hub's turning ring of pods reaches 31.
    let extent = $derived(piece.hub || piece.type === PieceType.NebulaSeeder ? 32 : 26)

    let name = $derived(
        piece.hub
            ? 'Hub'
            : piece.type === PieceType.Probe
              ? 'Probe'
              : piece.type === PieceType.Station
                ? 'Station'
                : piece.type === PieceType.Fighter
                  ? 'Fighter'
                  : describePiece(piece)
    )
</script>

<!-- The face and the back are two planes side by side in the wrapper that turns them, never one
     inside the other: a fade (opacity) flattens an element's 3D children, which would let the
     face show through the back mirrored, so only these leaf planes are ever faded. -->
<span
    data-card-layer
    class="{SHIP_CARD_FRAME} {textClass} {selected ? 'border-white' : 'border-white/50'}"
    style="background-color: {tint}{selected ? `; box-shadow: 0 0 14px ${tint}bf` : ''}{flippable
        ? '; backface-visibility: hidden'
        : ''}"
>
    <!-- Dimming sits on the face's parts, never the card: opacity would flatten its 3D and let
         the face show through the back as it turns. -->
    <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="{-extent} {-extent} {2 * extent} {2 * extent}"
        class={dimmed ? 'opacity-55' : ''}
    >
        {#if piece.type === PieceType.Probe}
            <ProbeShape {center} color={ink} level={piece.level ?? 2} />
        {:else if piece.type === PieceType.Station}
            <StationShape {center} color={ink} hub={piece.hub} />
        {:else if piece.type === PieceType.Fighter}
            <FighterShape {center} color={ink} level={piece.level ?? 2} {silhouette} />
        {:else}
            <UnitGlyph type={piece.type} color={ink} {center} />
        {/if}
    </svg>
    <span class="text-[11px] font-bold leading-none {dimmed ? 'opacity-55' : ''}">{name}</span>
    {#if piece.level}
        <span
            class="text-[8px] font-semibold uppercase tracking-[0.16em] {dimmed
                ? 'opacity-50'
                : 'opacity-90'}">level {piece.level}</span
        >
    {/if}
</span>
{#if flippable && back}
    <span
        data-card-layer
        class="absolute inset-0 overflow-hidden rounded-lg border border-white/25"
        style="transform: rotateY(180deg); backface-visibility: hidden"
    >
        <CardBack color={gameSession.colors.getPlayerColor(piece.playerId)} {tint} />
    </span>
{/if}
