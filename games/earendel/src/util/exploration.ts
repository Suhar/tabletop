import type { AxialCoordinates } from '@tabletop/common'
import { EarendelBoard, getHex, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'

// Landing a probe beside an unexplored planet is what triggers exploration - the player
// doesn't choose WHETHER to explore. But a hex touches six others, so a probe can land beside
// several unexplored planets at once, and it still explores only ONE of them. These are the
// planets it could explore; which one it does is the player's call.
export function explorablePlanets(
    board: EarendelBoard,
    coords: AxialCoordinates,
    pieceType: PieceType
): AxialCoordinates[] {
    if (pieceType !== PieceType.Probe) return []

    return neighborsOf(coords).filter((neighbor) => {
        const hex = getHex(board, neighbor)
        return hex?.kind === HexKind.Planet && !hex.explored
    })
}

// Marks the one chosen planet explored. Returns false if it wasn't a planet, or was already
// explored - a planet is explored once and never again.
export function markExplored(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = board.hexes[hexKey(coords)]
    if (!hex || hex.kind !== HexKind.Planet || hex.explored) return false
    hex.explored = true
    return true
}
