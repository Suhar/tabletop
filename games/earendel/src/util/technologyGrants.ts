import type { AxialCoordinates } from '@tabletop/common'
import { dominantPlayerId, type EarendelBoard, getHex, HexKind, neighborsOf } from '../model/board.js'

// Technologies a placement just handed its owner: those on explored planets the placement
// gave them OUTRIGHT hold of, and which they don't already hold.
//
// Outright, not merely tied - matching an opponent's presence is not a way to copy what they
// hold (see dominantPlayerId). Only the placing player can gain anything here, since a
// placement only ever adds to the placer's power: it can make them dominant, or break
// someone else's dominance, but it can never make a third party dominant.
//
// Players who lose a planet keep everything they had already gained; a technology, once
// gained, is never lost, and never gained twice by the same player.
export function technologiesGainedBy(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates,
    alreadyHeld: string[]
): string[] {
    const held = new Set(alreadyHeld)
    const gained: string[] = []

    for (const neighbor of neighborsOf(coords)) {
        const hex = getHex(board, neighbor)
        if (hex?.kind !== HexKind.Planet) continue
        if (!hex.technologyId || held.has(hex.technologyId)) continue
        if (dominantPlayerId(board, neighbor) !== playerId) continue

        held.add(hex.technologyId)
        gained.push(hex.technologyId)
    }

    return gained
}
