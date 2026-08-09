import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { PieceType, powerOf } from '../model/pieces.js'

// What a fighter that just landed here could destroy: adjacent pieces belonging to someone
// else, with strictly less power than the fighter itself.
//
// A fighter's level is its power, so a level 2 fighter clears probes and stations while a
// level 3 fighter also kills level 2 fighters. Nothing kills its equal, so a fighter is safe
// from anything but a bigger one - and a level 3 fighter is safe from everything.
export function destroyableTargets(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    const attacker = getHex(board, coords)?.piece
    if (attacker?.type !== PieceType.Fighter || attacker.playerId !== playerId) return []

    const power = powerOf(attacker)

    return neighborsOf(coords).filter((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece !== undefined && piece.playerId !== playerId && powerOf(piece) < power
    })
}
