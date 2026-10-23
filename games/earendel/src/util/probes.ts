import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf, sameHex } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'

// Probe influence: how strongly each player is surveying a planet, counting probes alone. It is
// separate from control - stations and fighters hold planets for points, but only probes stake
// out a planet's technology.
//
// Each adjacent probe counts its level, so a level 3 probe outweighs a level 2. A probe won from
// a technology without a level of its own counts at the weaker level, as it reveals.
//
// `arriving` counts a probe that is not on the board yet, so a placement can be judged before it
// is made; the hex it would stand on is skipped in the board walk.
export function probeInfluence(
    board: EarendelBoard,
    planet: AxialCoordinates,
    arriving?: { coords: AxialCoordinates; piece: Piece }
): Record<string, number> {
    const influence: Record<string, number> = {}
    const add = (piece: Piece) => {
        if (piece.type !== PieceType.Probe) return
        influence[piece.playerId] = (influence[piece.playerId] ?? 0) + (piece.level ?? PieceLevel.Two)
    }

    for (const neighbor of neighborsOf(planet)) {
        if (arriving && sameHex(neighbor, arriving.coords)) {
            add(arriving.piece)
            continue
        }
        const piece = getHex(board, neighbor)?.piece
        if (piece) add(piece)
    }

    return influence
}

// The player with strictly the most probe influence on a planet, or undefined when nobody has any
// or the lead is tied. Strict on purpose: a tie stakes out nothing, so matching a rival's probes
// is a way to block their claim, not to share it.
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
