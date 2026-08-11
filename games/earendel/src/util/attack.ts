import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { type Piece, PIECE_POWER, PieceLevel, PieceType, powerOf } from '../model/pieces.js'

// Piece types that can remove a station. Empty on purpose: a station is a structure, not a
// ship, and no fighter is going to shift one whatever its level. Station-killing is meant to
// arrive as a special piece won from a technology, and when it does it goes here - a new
// piece type with its own entry, not a change to what fighters can do.
const STATION_KILLERS: PieceType[] = []

// What a shot does, or nothing if it cannot be taken at all.
//
// Power decides the contest and nothing touches its equal, so a fighter is safe from anything
// but a bigger one. Stations are immune regardless of power, which is why a level 2 fighter
// can only reach probes.
//
// A fighter that IS reachable is worn down rather than removed: one hit costs it a level, and
// since a fighter's level is its power, a damaged fighter is a weaker claim on the planets
// around it as well as easier to finish off. Anything else in reach is destroyed outright.
export enum AttackOutcome {
    Destroyed = 'destroyed',
    Damaged = 'damaged'
}

export function attackOutcome(attacker: Piece, target: Piece): AttackOutcome | undefined {
    if (attacker.playerId === target.playerId) return undefined
    if (powerOf(target) >= powerOf(attacker)) return undefined
    if (target.type === PieceType.Station && !STATION_KILLERS.includes(attacker.type)) {
        return undefined
    }

    const level = target.level ?? PIECE_POWER[PieceType.Fighter]
    return target.type === PieceType.Fighter && level > PieceLevel.One
        ? AttackOutcome.Damaged
        : AttackOutcome.Destroyed
}

export function canAttack(attacker: Piece, target: Piece): boolean {
    return attackOutcome(attacker, target) !== undefined
}

// What a fighter that just landed here could fire on: adjacent pieces belonging to someone
// else that it can reach. Some it destroys, some it merely damages - see attackOutcome.
export function attackableTargets(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    const attacker = getHex(board, coords)?.piece
    if (attacker?.type !== PieceType.Fighter || attacker.playerId !== playerId) return []

    return neighborsOf(coords).filter((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece !== undefined && canAttack(attacker, piece)
    })
}
