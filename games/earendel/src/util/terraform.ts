import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'

function isTerraformer(board: EarendelBoard, coords: AxialCoordinates): boolean {
    return getHex(board, coords)?.piece?.type === PieceType.Terraformer
}

// The planets a terraformer at coords may recolour: those beside it that no other terraformer
// touches (rules.md, Terraformer).
export function terraformablePlanets(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    if (!isTerraformer(board, coords)) return []

    return neighborsOf(coords).filter((planet) => {
        if (getHex(board, planet)?.kind !== HexKind.Planet) return false
        return neighborsOf(planet).every(
            (neighbor) =>
                (neighbor.q === coords.q && neighbor.r === coords.r) ||
                !isTerraformer(board, neighbor)
        )
    })
}
