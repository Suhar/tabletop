import type { AxialCoordinates } from '@tabletop/common'
import { EarendelBoard, getHex, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'

// Exploring isn't a decision - it happens BECAUSE a probe landed next to an unexplored
// planet. One probe can reach several planets at once (a hex touches six others), so this
// answers with all of them rather than one.
export function planetsExploredBy(
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

// Marks them explored and returns the ones that actually changed, so a caller can attach
// exactly what happened to the action's metadata - history should report a probe reaching
// two planets as two discoveries, and a probe reaching none as none.
export function markExplored(board: EarendelBoard, planets: AxialCoordinates[]): AxialCoordinates[] {
    const discovered: AxialCoordinates[] = []
    for (const coords of planets) {
        const hex = board.hexes[hexKey(coords)]
        if (!hex || hex.kind !== HexKind.Planet || hex.explored) continue
        hex.explored = true
        discovered.push(coords)
    }
    return discovered
}
