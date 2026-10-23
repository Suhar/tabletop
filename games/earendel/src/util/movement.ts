import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { probeBlockedBy } from './lineOfSight.js'

export type Move = { from: AxialCoordinates; to: AxialCoordinates }

export function destinationsFrom(board: EarendelBoard, from: AxialCoordinates): AxialCoordinates[] {
    const piece = getHex(board, from)?.piece
    if (!piece) return []

    return neighborsOf(from).filter((neighbor) => {
        const hex = getHex(board, neighbor)
        if (!hex || hex.kind !== HexKind.Open || hex.piece) return false
        if (piece.type !== PieceType.Probe) return true
        return probeBlockedBy(board, neighbor, piece.playerId) === undefined
    })
}

export function legalMovesFor(board: EarendelBoard, playerId: string): Move[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .flatMap((hex) =>
            destinationsFrom(board, hex.coords).map((to) => ({ from: hex.coords, to }))
        )
}
