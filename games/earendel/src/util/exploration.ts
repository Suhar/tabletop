import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, hexKey, neighborsOf, sameHex } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { probeLeaderOf } from './probes.js'

// The planets a probe on `coords` may survey: those beside it where its player has strictly the
// most probe influence, counting this probe. A planet where they don't lead is not offered at all.
//
// An unexplored planet is explored - its technology chosen from cards revealed by the probe's
// level - and an explored one offers the technology it already holds. Either way the player then
// has a claim on that technology, gained at the start of their next turn if they still lead (see
// claimProbeTechnologies). So an explored planet is only worth surveying for a technology the
// player doesn't have, and a planet they already have a claim on is not offered again.
//
// Works before the probe is placed as well as after, so the board can preview a placement: a
// probe not yet standing on `coords` is counted there as if it were.
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

// Marks the one chosen planet explored. Returns false if it wasn't a planet, or was already
// explored - a planet is explored once and never again.
export function markExplored(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = board.hexes[hexKey(coords)]
    if (!hex || hex.kind !== HexKind.Planet || hex.explored) return false
    hex.explored = true
    return true
}
