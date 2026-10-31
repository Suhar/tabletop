import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { type Piece, PIECE_POWER, PieceLevel, PieceType, powerOf } from '../model/pieces.js'
import { relayStationsOf } from './lineOfSight.js'

// Empty on purpose: no piece type can remove a station yet.
const STATION_KILLERS: PieceType[] = []

export enum AttackOutcome {
    Destroyed = 'destroyed',
    Damaged = 'damaged'
}

export function isEscorted(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const piece = getHex(board, coords)?.piece
    if (!piece) return false

    return neighborsOf(coords).some((neighbor) => {
        const guard = getHex(board, neighbor)?.piece
        return guard?.playerId === piece.playerId && guard.type === PieceType.Fighter
    })
}

export function attackOutcome(attacker: Piece, target: Piece): AttackOutcome | undefined {
    if (attacker.playerId === target.playerId) return undefined
    if (powerOf(target) > powerOf(attacker)) return undefined
    if (target.type === PieceType.Station && !STATION_KILLERS.includes(attacker.type)) {
        return undefined
    }
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
    if (isEscorted(board, targetCoords)) return undefined
    if (relayStationsOf(board, targetCoords).length > 0) return undefined

    return attackOutcome(attacker, target)
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
): { target: Piece; damaged: boolean; levelAfter?: number } | undefined {
    const hex = getHex(board, targetCoords)
    const target = hex?.piece
    if (!hex || !target) return undefined

    const outcome = attackOutcomeAt(board, attackerCoords, targetCoords)
    if (!outcome) return undefined

    const damaged = outcome === AttackOutcome.Damaged && !destroyOutright
    if (damaged) {
        const levelAfter = (target.level ?? PieceLevel.Two) - 1
        hex.piece = { ...target, level: levelAfter }
        return { target, damaged: true, levelAfter }
    }

    hex.piece = undefined
    return { target, damaged: false }
}
