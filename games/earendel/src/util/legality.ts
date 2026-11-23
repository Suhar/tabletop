import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { attackableTargets } from './attack.js'

export function feintTargets(
    board: EarendelBoard,
    from: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    if (getHex(board, from)?.piece?.playerId !== playerId) return []

    return neighborsOf(from).filter((neighbor) => {
        const piece = getHex(board, neighbor)?.piece
        return piece !== undefined && piece.playerId !== playerId
    })
}

export function feintableShips(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .map((hex) => hex.coords)
        .filter((coords) => feintTargets(board, coords, playerId).length > 0)
}

export function canWakeFighter(
    board: EarendelBoard,
    coords: AxialCoordinates,
    playerId: string
): boolean {
    const piece = getHex(board, coords)?.piece
    return (
        piece?.playerId === playerId &&
        piece.type === PieceType.Fighter &&
        attackableTargets(board, coords, playerId).length > 0
    )
}

export function wakeableFighters(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .map((hex) => hex.coords)
        .filter((coords) => canWakeFighter(board, coords, playerId))
}
