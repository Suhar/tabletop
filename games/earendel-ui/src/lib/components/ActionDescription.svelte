<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        type ChoosePlanet,
        type ChooseTechnology,
        type DestroyPiece,
        isChoosePlanet,
        isChooseTechnology,
        isDestroyPiece,
        isPass,
        isDiscardPiece,
        type DiscardPiece,
        isDrawPieces,
        type DrawPieces,
        isUseLogisticsUpgrade,
        type UseLogisticsUpgrade,
        isMovePiece,
        isPlacePiece,
        isPlaceTile,
        type PlaceTile,
        type MovePiece,
        type PlacePiece
    } from '@tabletop/earendel'
    import { describePiece } from '$lib/model/session.svelte.js'

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

    const techName = (id?: string) => (id ? id.replace('tech-', 'Tech ') : 'nothing')

    // History is read after the fact, so it has to say what happened rather than what was
    // clicked - which piece came out of the bag, what the flip turned up, who lost a ship.
    let text = $derived.by(() => {
        if (isPlacePiece(action)) {
            const placed = action as PlacePiece
            const parts: string[] = [`placed a ${placed.metadata?.pieceType ?? 'ship'}`]
            if (placed.metadata?.returnedToBag) {
                parts.push(
                    `(putting a ${describePiece(placed.metadata.returnedToBag)} back in the bag)`
                )
            }
            if (placed.metadata?.stationGroupPoints) {
                const points = placed.metadata.stationGroupPoints
                parts.push(
                    points === 1
                        ? 'for 1'
                        : `joining a group of ${points} stations for ${points}`
                )
            }
            for (const chain of placed.metadata?.chains ?? []) {
                parts.push(
                    `and joined two ${chain.color} planets with ${chain.length} ${
                        chain.length === 1 ? 'ship' : 'ships'
                    } for ${chain.points}`
                )
            }
            return parts.join(' ')
        }
        if (isChoosePlanet(action)) {
            const chosen = action as ChoosePlanet
            const flipped = chosen.metadata?.flipped?.length ?? 0
            return `explored a planet, turning over ${flipped} ${flipped === 1 ? 'card' : 'cards'}`
        }
        if (isChooseTechnology(action)) {
            const chosen = action as ChooseTechnology
            return chosen.metadata?.noTechnologyAvailable
                ? 'found nothing the planet could hold'
                : `housed ${techName(chosen.metadata?.technologyId)} on the planet`
        }
        if (isDestroyPiece(action)) {
            const shot = action as DestroyPiece
            return shot.metadata?.declined
                ? 'held fire'
                : `destroyed a ${shot.metadata?.destroyed?.type ?? 'ship'}`
        }
        if (isDrawPieces(action)) {
            const drew = action as DrawPieces
            const count = drew.metadata?.drawn?.length ?? 0
            return `drew ${count} ${count === 1 ? 'ship' : 'ships'}`
        }
        if (isUseLogisticsUpgrade(action)) {
            const used = action as UseLogisticsUpgrade
            return `spent a Logistics Upgrade, keeping all ${used.metadata?.piecesKept ?? 3} ships`
        }
        if (isDiscardPiece(action)) {
            const discard = action as DiscardPiece
            return discard.metadata?.nothingToDiscard
                ? 'drew the last of the bag, with nothing to discard'
                : `drafted three and discarded a ${discard.metadata?.discarded?.type ?? 'ship'}`
        }
        if (isPlaceTile(action)) {
            const laid = action as PlaceTile
            return laid.metadata?.noTilePlaced
                ? 'had nowhere to lay the new tile'
                : laid.metadata?.noShipPlaced
                  ? 'laid a new tile, with no ship left to put on it'
                  : 'laid a new tile'
        }
        if (isMovePiece(action)) {
            const moved = action as MovePiece
            if (moved.metadata?.noMoveAvailable) return 'had nothing the technology could move'
            if (moved.metadata?.declined) return 'held position rather than moving'
            return `moved a ${moved.metadata?.piece?.type ?? 'ship'} one space`
        }
        if (isPass(action)) return 'could not place, ending the game'
        return action.type
    })
</script>

<div class="flex flex-row justify-{justify} items-center flex-wrap gap-x-1">
    <PlayerName playerId={action.playerId} />
    <span>{text}</span>
</div>
