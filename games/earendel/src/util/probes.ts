import { sameCoordinates } from '@tabletop/common'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsThrough } from '../model/board.js'
import { CARRIER_LEVEL, type Piece, PieceLevel, PieceType } from '../model/pieces.js'

export function probeInfluence(
    board: EarendelBoard,
    planet: AxialCoordinates,
    arriving?: { coords: AxialCoordinates; piece: Piece }
): Record<string, number> {
    const influence: Record<string, number> = {}
    const add = (piece: Piece) => {
        // A carrier counts as a probe of CARRIER_LEVEL on every planet beside it.
        if (piece.type === PieceType.Carrier) {
            influence[piece.playerId] = (influence[piece.playerId] ?? 0) + CARRIER_LEVEL
            return
        }
        if (piece.type !== PieceType.Probe) return
        // A probe that surveyed another planet is committed there and counts nowhere else.
        if (piece.surveying && !sameCoordinates(piece.surveying, planet)) return
        influence[piece.playerId] =
            (influence[piece.playerId] ?? 0) + (piece.level ?? PieceLevel.Two)
    }

    // Through a gate pair, what stands beside one gate stands beside the other.
    for (const neighbor of neighborsThrough(board, planet)) {
        if (arriving && sameCoordinates(neighbor, arriving.coords)) {
            add(arriving.piece)
            continue
        }
        const piece = getHex(board, neighbor)?.piece
        if (piece) add(piece)
    }

    return influence
}

export function probeLeaderOf(
    board: EarendelBoard,
    planet: AxialCoordinates,
    arriving?: { coords: AxialCoordinates; piece: Piece }
): string | undefined {
    const influence = Object.entries(probeInfluence(board, planet, arriving))
    let leader: string | undefined
    let best = 0
    let tied = false

    for (const [playerId, value] of influence) {
        if (value > best) {
            leader = playerId
            best = value
            tied = false
        } else if (value === best) {
            tied = true
        }
    }

    return tied ? undefined : leader
}
