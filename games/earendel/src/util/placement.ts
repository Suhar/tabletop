import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, isOpenHex } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { probeBlockedBy } from './lineOfSight.js'
import { interdictedFor } from './specials.js'

export function legalPlacementsFor(
    board: EarendelBoard,
    playerId: string,
    piece: Piece
): AxialCoordinates[] {
    // Scrap has no function: it goes nowhere on the board, and is played from the hand instead.
    if (piece.type === PieceType.Scrap) return []

    const open = Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Open && isOpenHex(board, hex.coords))
        .map((hex) => hex.coords)
        .filter((coords) => !interdictedFor(board, coords, playerId))

    if (piece.type !== PieceType.Probe) return open

    return open.filter((coords) => probeBlockedBy(board, coords, playerId) === undefined)
}

export function legalPlacementsOnTile(
    board: EarendelBoard,
    playerId: string,
    piece: Piece,
    tileId: string
): AxialCoordinates[] {
    return legalPlacementsFor(board, playerId, piece).filter(
        (coords) => getHex(board, coords)?.tileId === tileId
    )
}

export function hasAnyPlacement(
    board: EarendelBoard,
    playerId: string,
    held: Piece[],
    specials: Piece[]
): boolean {
    // A Scrap can always be played: it needs no hex.
    if (held.some((piece) => piece.type === PieceType.Scrap)) return true
    return [...held, ...specials].some(
        (piece) => legalPlacementsFor(board, playerId, piece).length > 0
    )
}

// The special pieces a player may still play this turn: any, until a drafted ship is placed.
export function playableSpecials(state: HydratedEarendelGameState, playerId: string): Piece[] {
    if (state.shipPlacedThisTurn) return []
    return state.getPlayerState(playerId).specialPieces
}
