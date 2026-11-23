import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, neighborsOf } from '../model/board.js'
import { destinationsFrom } from './movement.js'

// Spoofed Orders (rules.md, One-shot technologies): the rival pieces a player could send a step,
// which are those standing beside one of the player's own with somewhere to go. Where a piece
// may step is its own owner's business: a probe still cannot enter a blockade closed to it.
export function spoofablePieces(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece !== undefined && hex.piece.playerId !== playerId)
        .filter((hex) =>
            neighborsOf(hex.coords).some(
                (neighbor) => getHex(board, neighbor)?.piece?.playerId === playerId
            )
        )
        .filter((hex) => destinationsFrom(board, hex.coords).length > 0)
        .map((hex) => hex.coords)
}
