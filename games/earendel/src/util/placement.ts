import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, isOpenHex } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { probeBlockedBy } from './lineOfSight.js'

// Every hex this particular piece could legally be placed on. Open space, minus - for a probe
// only - anything closed off by an enemy station pair.
//
// The piece matters, which is why this can't be answered from the board alone: a hex shut to
// a probe is perfectly available to the fighter behind it in the same bag.
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

// Whether this player has any legal placement at all, counting everything they are holding and
// every special piece in front of them. False is the one case where a turn has nothing to do -
// holding only probes while every open hex is closed to them - and it ends the game.
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
