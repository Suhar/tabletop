import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { type Piece, PieceType, powerOf } from '../model/pieces.js'

// Piece types that can remove a station. Empty on purpose: a station is a structure, not a
// ship, and no fighter is going to shift one whatever its level. Station-killing is meant to
// arrive as a special piece won from a technology, and when it does it goes here - a new
// piece type with its own entry, not a change to what fighters can do.
const STATION_KILLERS: PieceType[] = []

// The whole of who-can-destroy-what, in one place.
//
// Power decides the contest and nothing destroys its equal, so a fighter is safe from
// anything but a bigger one. The station exception sits on top of that: stations are immune
// regardless of power, which is why a level 2 fighter can only clear probes.
export function canDestroy(attacker: Piece, target: Piece): boolean {
    if (attacker.playerId === target.playerId) return false
    if (powerOf(target) >= powerOf(attacker)) return false
    if (target.type === PieceType.Station && !STATION_KILLERS.includes(attacker.type)) return false
    return true
}

// What a fighter that just landed here could destroy: adjacent pieces belonging to someone
// else that it is able to remove.
export function destroyableTargets(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    const attacker = getHex(board, coords)?.piece
    if (attacker?.type !== PieceType.Fighter || attacker.playerId !== playerId) return []

    return neighborsOf(coords).filter((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece !== undefined && canDestroy(attacker, piece)
    })
}
