import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    neighborsOf,
    planetControl
} from '../model/board.js'

// Technologies a placement just handed its owner: those on explored planets the placement
// brought them into control of, and which they don't already hold.
//
// Only the placing player can gain anything here. Control is whoever has the most power
// around a planet, and a placement only ever ADDS to the placer's power - it can push them
// into the controlling set, or push others out of it, but it can never put a third party in.
// Players pushed out keep everything they had already gained; a technology, once gained, is
// never lost.
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
        if (!planetControl(board, neighbor).controllingPlayerIds.includes(playerId)) continue

        held.add(hex.technologyId)
        gained.push(hex.technologyId)
    }

    return gained
}
