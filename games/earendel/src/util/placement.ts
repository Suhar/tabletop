import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, isOpenHex } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { probeBlockedBy } from './lineOfSight.js'

export function legalPlacementsFor(
    board: EarendelBoard,
    playerId: string,
    piece: Piece
): AxialCoordinates[] {
    const open = Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Open && isOpenHex(board, hex.coords))
        .map((hex) => hex.coords)

    if (piece.type !== PieceType.Probe) return open

    return open.filter((coords) => probeBlockedBy(board, coords, playerId) === undefined)
}

export function hasAnyPlacement(
    board: EarendelBoard,
    playerId: string,
    held: Piece[],
    specials: Piece[]
): boolean {
    return [...held, ...specials].some(
        (piece) => legalPlacementsFor(board, playerId, piece).length > 0
    )
}
