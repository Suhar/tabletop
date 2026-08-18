import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { type Piece, PIECE_POWER, PieceLevel, PieceType, powerOf } from '../model/pieces.js'

// Piece types that can remove a station. Empty on purpose: a station is a structure, not a
// ship, and no fighter is going to shift one whatever its level. Station-killing is meant to
// arrive as a special piece won from a technology, and when it does it goes here - a new
// piece type with its own entry, not a change to what fighters can do.
const STATION_KILLERS: PieceType[] = []

export enum AttackOutcome {
    Destroyed = 'destroyed',
    Damaged = 'damaged'
}

// Whether a piece is under escort: standing next to a fighter of its OWN side. An escorted
// piece cannot be attacked at all - not damaged, not destroyed, whatever is shooting at it.
//
// This is what makes a fighter more than a gun. A lone fighter threatens its six neighbours; a
// pair of fighters side by side cover each other and cannot be touched, and a fighter parked
// beside a station makes that station's whole hex safe. Anything a player wants to keep now has
// somewhere to keep it, and taking ground means bringing enough fighters to shoot the escort
// first - except an escort cannot BE shot while it is itself escorted, so a line of fighters is
// only breakable at its ends.
//
// A fighter does not escort itself: a lone fighter is as exposed as anything else. Nothing yet
// pierces an escort, but that is the hook a technology would use when one exists.
export function isEscorted(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const piece = getHex(board, coords)?.piece
    if (!piece) return false

    return neighborsOf(coords).some((neighbor) => {
        const guard = getHex(board, neighbor)?.piece
        return guard?.playerId === piece.playerId && guard.type === PieceType.Fighter
    })
}

// What a shot does, or nothing if it cannot be taken at all.
//
// A fighter reaches anything of its own level or BELOW: a level 2 fighter can wear down another
// level 2, where it used to need to outrank its target outright. Equal fighters were
// permanently safe from each other, which made a level 3 the only piece on the board worth
// having and left two level 2s staring at each other forever.
//
// Stations are immune regardless of power. Escorted pieces are immune regardless of anything -
// see isEscorted, which is checked by the callers that know where the target stands.
//
// A fighter that IS reachable is worn down rather than removed: one hit costs it a level, and
// since a fighter's level is its power, a damaged fighter is a weaker claim on the planets
// around it as well as easier to finish off. Anything else in reach is destroyed outright.
export function attackOutcome(attacker: Piece, target: Piece): AttackOutcome | undefined {
    if (attacker.playerId === target.playerId) return undefined
    if (powerOf(target) > powerOf(attacker)) return undefined
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

// The same question, asked where the pieces actually stand - which is the only place the escort
// rule can be answered. Every caller that has coordinates should use this rather than
// attackOutcome, so the escort cannot be forgotten at one call site and honoured at another.
export function attackOutcomeAt(
    board: EarendelBoard,
    attackerCoords: AxialCoordinates,
    targetCoords: AxialCoordinates
): AttackOutcome | undefined {
    const attacker = getHex(board, attackerCoords)?.piece
    const target = getHex(board, targetCoords)?.piece
    if (!attacker || !target) return undefined
    if (isEscorted(board, targetCoords)) return undefined

    return attackOutcome(attacker, target)
}

// What a fighter that just landed here could fire on: adjacent pieces belonging to someone
// else that it can reach, and that nothing of theirs is escorting.
export function attackableTargets(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    const attacker = getHex(board, coords)?.piece
    if (attacker?.type !== PieceType.Fighter || attacker.playerId !== playerId) return []

    return neighborsOf(coords).filter(
        (neighbor) => attackOutcomeAt(board, coords, neighbor) !== undefined
    )
}

// Carries out one shot on the board and reports what it did. Shared by the single attack and by
// Full Torpedo Spread, so a spread cannot drift from an ordinary shot: the wearing-down rule, the
// escort and the Railgun's override are all decided in one place, once.
//
// Returns undefined if there was nothing to shoot - the callers validate before calling, so this
// is a guard rather than a path.
export function resolveShot(
    board: EarendelBoard,
    attackerCoords: AxialCoordinates,
    targetCoords: AxialCoordinates,
    destroyOutright = false
): { target: Piece; damaged: boolean; levelAfter?: number } | undefined {
    const hex = getHex(board, targetCoords)
    const target = hex?.piece
    if (!hex || !target) return undefined

    const outcome = attackOutcomeAt(board, attackerCoords, targetCoords)
    if (!outcome) return undefined

    // A level is a fighter's power as well as its staying power, so wearing one down weakens its
    // hold on the planets around it at the same time.
    const damaged = outcome === AttackOutcome.Damaged && !destroyOutright
    if (damaged) {
        const levelAfter = (target.level ?? PieceLevel.Two) - 1
        hex.piece = { ...target, level: levelAfter }
        return { target, damaged: true, levelAfter }
    }

    hex.piece = undefined
    return { target, damaged: false }
}
