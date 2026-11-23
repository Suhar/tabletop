import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf, neighborsThrough } from '../model/board.js'
import {
    CARRIER_LEVEL,
    type Piece,
    PIECE_POWER,
    PieceLevel,
    PieceType,
    powerOf
} from '../model/pieces.js'
import { shieldedByBastion } from './specials.js'
import { relayStationsOf } from './lineOfSight.js'
import { ruleInForce } from './rules.js'
import { TechnologyEffectKind } from '../model/technology.js'

export enum AttackOutcome {
    Destroyed = 'destroyed',
    Damaged = 'damaged'
}

// A fighter of the piece's own side beside it, a gate pair counting as one place.
export function isEscorted(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const piece = getHex(board, coords)?.piece
    if (!piece) return false

    return neighborsThrough(board, coords).some((neighbor) => {
        const guard = getHex(board, neighbor)?.piece
        return guard?.playerId === piece.playerId && guard.type === PieceType.Fighter
    })
}

export function attackOutcome(attacker: Piece, target: Piece): AttackOutcome | undefined {
    // A torpedo takes one station or bastion, whoever owns it, and nothing else (rules.md,
    // Gamma Torpedo).
    if (attacker.torpedo) {
        return target.type === PieceType.Station || target.type === PieceType.Bastion
            ? AttackOutcome.Destroyed
            : undefined
    }
    if (attacker.playerId === target.playerId) return undefined
    if (powerOf(target) > powerOf(attacker)) return undefined
    // A station is a structure, not a ship: only a torpedo removes one, as with a bastion.
    if (target.type === PieceType.Station || target.type === PieceType.Bastion) return undefined
    // A carrier takes a fighter of its own level to touch.
    if (target.type === PieceType.Carrier && powerOf(attacker) < CARRIER_LEVEL) return undefined
    // Terraformers and relays are out of the fight entirely, like stations.
    if (target.type === PieceType.Terraformer || target.type === PieceType.Relay) return undefined

    const level = target.level ?? PIECE_POWER[PieceType.Fighter]
    return target.type === PieceType.Fighter && level > PieceLevel.One
        ? AttackOutcome.Damaged
        : AttackOutcome.Destroyed
}

export function canAttack(attacker: Piece, target: Piece): boolean {
    return attackOutcome(attacker, target) !== undefined
}

export function attackOutcomeAt(
    board: EarendelBoard,
    attackerCoords: AxialCoordinates,
    targetCoords: AxialCoordinates
): AttackOutcome | undefined {
    const attacker = getHex(board, attackerCoords)?.piece
    const target = getHex(board, targetCoords)?.piece
    if (!attacker || !target) return undefined
    // A torpedo is a blast, not a shot: neither an escort nor a relay's cover turns it. Under
    // No Quarter (rules.md, Elevated technologies) fighters' escorts protect nobody; a
    // bastion's shield holds regardless.
    if (!attacker.torpedo) {
        if (
            !ruleInForce(board, TechnologyEffectKind.NoQuarter) &&
            isEscorted(board, targetCoords)
        ) {
            return undefined
        }
        if (shieldedByBastion(board, targetCoords)) return undefined
        if (relayStationsOf(board, targetCoords).length > 0) return undefined
    }

    return attackOutcome(attacker, target)
}

// The stations, and bastions, a torpedo placed at coords could take with it.
export function torpedoTargets(board: EarendelBoard, coords: AxialCoordinates): AxialCoordinates[] {
    return neighborsOf(coords).filter((neighbor) => {
        const type = getHex(board, neighbor)?.piece?.type
        return type === PieceType.Station || type === PieceType.Bastion
    })
}

export function isTorpedoAt(board: EarendelBoard, coords: AxialCoordinates): boolean {
    return getHex(board, coords)?.piece?.torpedo === true
}

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

export function resolveShot(
    board: EarendelBoard,
    attackerCoords: AxialCoordinates,
    targetCoords: AxialCoordinates,
    destroyOutright = false
): { target: Piece; damaged: boolean; levelAfter?: number; spent?: Piece } | undefined {
    const hex = getHex(board, targetCoords)
    const target = hex?.piece
    if (!hex || !target) return undefined

    const outcome = attackOutcomeAt(board, attackerCoords, targetCoords)
    if (!outcome) return undefined

    // A torpedo goes with its target.
    const attackerHex = getHex(board, attackerCoords)
    const spent = attackerHex?.piece?.torpedo ? attackerHex.piece : undefined
    if (attackerHex && spent) {
        attackerHex.piece = undefined
        hex.piece = undefined
        return { target, damaged: false, spent }
    }

    const damaged = outcome === AttackOutcome.Damaged && !destroyOutright
    if (damaged) {
        const levelAfter = (target.level ?? PieceLevel.Two) - 1
        hex.piece = { ...target, level: levelAfter }
        return { target, damaged: true, levelAfter }
    }

    hex.piece = undefined
    return { target, damaged: false }
}
