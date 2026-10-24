import { sameCoordinates } from '@tabletop/common'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'

export function probeInfluence(
    board: EarendelBoard,
    planet: AxialCoordinates,
    arriving?: { coords: AxialCoordinates; piece: Piece }
): Record<string, number> {
    const influence: Record<string, number> = {}
    const add = (piece: Piece) => {
        if (piece.type !== PieceType.Probe) return
        influence[piece.playerId] =
            (influence[piece.playerId] ?? 0) + (piece.level ?? PieceLevel.Two)
    }

    for (const neighbor of neighborsOf(planet)) {
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
