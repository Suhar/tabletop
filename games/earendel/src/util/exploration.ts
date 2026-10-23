import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    sameHex
} from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { probeLeaderOf } from './probes.js'

// Also previews: a probe not yet standing on `coords` is counted there.
export function probeDestinations(
    state: HydratedEarendelGameState,
    coords: AxialCoordinates,
    piece: Piece
): AxialCoordinates[] {
    if (piece.type !== PieceType.Probe) return []

    const onBoard = getHex(state.board, coords)?.piece?.id === piece.id
    const arriving = onBoard ? undefined : { coords, piece }
    const held = state.getPlayerState(piece.playerId).technologies

    return neighborsOf(coords).filter((neighbor) => {
        const hex = getHex(state.board, neighbor)
        if (hex?.kind !== HexKind.Planet) return false
        if (probeLeaderOf(state.board, neighbor, arriving) !== piece.playerId) return false
        if (
            state.probeClaims.some(
                (claim) => claim.playerId === piece.playerId && sameHex(claim.coords, neighbor)
            )
        ) {
            return false
        }
        if (!hex.explored) return true
        return hex.technology !== undefined && !held.includes(hex.technology.id)
    })
}

export function markExplored(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = board.hexes[hexKey(coords)]
    if (!hex || hex.kind !== HexKind.Planet || hex.explored) return false
    hex.explored = true
    return true
}
