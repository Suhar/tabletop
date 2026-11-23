import { sameCoordinates } from '@tabletop/common'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, hexKey, neighborsThrough } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import type { ProbeClaim } from '../model/exploration.js'
import { probeInfluence, probeLeaderOf } from './probes.js'
import { quarantined } from './specials.js'

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

    return neighborsThrough(state.board, coords).filter((neighbor) => {
        const hex = getHex(state.board, neighbor)
        if (hex?.kind !== HexKind.Planet) return false
        if (quarantined(state.board, neighbor)) return false
        if (probeLeaderOf(state.board, neighbor, arriving) !== piece.playerId) return false
        if (
            state.probeClaims.some(
                (claim) =>
                    claim.playerId === piece.playerId && sameCoordinates(claim.coords, neighbor)
            )
        ) {
            return false
        }
        if (!hex.explored) return true
        return hex.technologyId !== undefined && !held.includes(hex.technologyId)
    })
}

// Rival claims that fail only because this uncommitted probe stands beside their planet: they pay
// again the moment it surveys somewhere else (rules.md, Gaining a technology).
export function claimsBlockedBy(
    state: HydratedEarendelGameState,
    probeCoords: AxialCoordinates
): ProbeClaim[] {
    const probe = getHex(state.board, probeCoords)?.piece
    if (probe?.type !== PieceType.Probe || probe.surveying) return []
    const beside = neighborsThrough(state.board, probeCoords)

    return state.probeClaims.filter((claim) => {
        if (claim.playerId === probe.playerId) return false
        if (!beside.some((coords) => sameCoordinates(coords, claim.coords))) return false
        if (probeLeaderOf(state.board, claim.coords) === claim.playerId) return false

        const influence = probeInfluence(state.board, claim.coords)
        const without = {
            ...influence,
            [probe.playerId]: (influence[probe.playerId] ?? 0) - (probe.level ?? PieceLevel.Two)
        }
        const claimant = without[claim.playerId] ?? 0
        return Object.entries(without).every(
            ([playerId, value]) => playerId === claim.playerId || value < claimant
        )
    })
}

export function markExplored(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = board.hexes[hexKey(coords)]
    if (!hex || hex.kind !== HexKind.Planet || hex.explored) return false
    hex.explored = true
    return true
}
