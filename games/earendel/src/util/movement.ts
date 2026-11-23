import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, hexKey, neighborsOf } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { probeBlockedBy } from './lineOfSight.js'
import { interdictedFor } from './specials.js'

export type Move = { from: AxialCoordinates; to: AxialCoordinates }

export function destinationsFrom(board: EarendelBoard, from: AxialCoordinates): AxialCoordinates[] {
    const piece = getHex(board, from)?.piece
    if (!piece) return []

    return neighborsOf(from).filter((neighbor) => {
        const hex = getHex(board, neighbor)
        if (!hex || hex.kind !== HexKind.Open || hex.piece) return false
        if (interdictedFor(board, neighbor, piece.playerId)) return false
        if (piece.type !== PieceType.Probe) return true
        return probeBlockedBy(board, neighbor, piece.playerId) === undefined
    })
}

// Warp Drive: where a piece could come out, traveling through any number of empty open hexes.
// The way there needs only to be empty space; where it lands must be open to the piece, as for
// a step.
export function warpDestinationsFrom(
    board: EarendelBoard,
    from: AxialCoordinates
): AxialCoordinates[] {
    const piece = getHex(board, from)?.piece
    if (!piece) return []

    const seen = new Set([hexKey(from)])
    const frontier = [from]
    const reached: AxialCoordinates[] = []
    for (let at = frontier.pop(); at; at = frontier.pop()) {
        for (const neighbor of neighborsOf(at)) {
            const key = hexKey(neighbor)
            if (seen.has(key)) continue
            seen.add(key)
            const hex = getHex(board, neighbor)
            if (!hex || hex.kind !== HexKind.Open || hex.piece) continue
            frontier.push(neighbor)
            reached.push(neighbor)
        }
    }

    return reached.filter((coords) => {
        if (interdictedFor(board, coords, piece.playerId)) return false
        if (piece.type !== PieceType.Probe) return true
        return probeBlockedBy(board, coords, piece.playerId) === undefined
    })
}

// The hexes on the outer border of the map: those with open sky beside them, meaning a missing
// hex that the outside reaches. A gap enclosed by the board is not the border.
export function borderHexes(board: EarendelBoard): AxialCoordinates[] {
    const hexes = Object.values(board.hexes)
    if (hexes.length === 0) return []
    const qs = hexes.map((hex) => hex.coords.q)
    const rs = hexes.map((hex) => hex.coords.r)
    const min = { q: Math.min(...qs) - 1, r: Math.min(...rs) - 1 }
    const max = { q: Math.max(...qs) + 1, r: Math.max(...rs) + 1 }
    const inFrame = (at: AxialCoordinates) =>
        at.q >= min.q && at.q <= max.q && at.r >= min.r && at.r <= max.r

    // The frame's corner is off the board; everything missing that it reaches is outside.
    const outside = new Set([hexKey(min)])
    const frontier: AxialCoordinates[] = [min]
    for (let at = frontier.pop(); at; at = frontier.pop()) {
        for (const neighbor of neighborsOf(at)) {
            const key = hexKey(neighbor)
            if (outside.has(key) || !inFrame(neighbor) || getHex(board, neighbor)) continue
            outside.add(key)
            frontier.push(neighbor)
        }
    }

    return hexes
        .map((hex) => hex.coords)
        .filter((coords) => neighborsOf(coords).some((neighbor) => outside.has(hexKey(neighbor))))
}

// Dimensional Rift: from a border hex, the empty border hexes a piece could come out on.
export function riftDestinationsFrom(
    board: EarendelBoard,
    from: AxialCoordinates
): AxialCoordinates[] {
    const piece = getHex(board, from)?.piece
    if (!piece) return []
    const border = borderHexes(board)
    if (!border.some((coords) => hexKey(coords) === hexKey(from))) return []

    return border.filter((coords) => {
        const hex = getHex(board, coords)
        if (!hex || hex.kind !== HexKind.Open || hex.piece) return false
        if (interdictedFor(board, coords, piece.playerId)) return false
        if (piece.type !== PieceType.Probe) return true
        return probeBlockedBy(board, coords, piece.playerId) === undefined
    })
}

export function legalRiftsFor(board: EarendelBoard, playerId: string): Move[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .flatMap((hex) =>
            riftDestinationsFrom(board, hex.coords).map((to) => ({ from: hex.coords, to }))
        )
}

export function legalWarpsFor(board: EarendelBoard, playerId: string): Move[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .flatMap((hex) =>
            warpDestinationsFrom(board, hex.coords).map((to) => ({ from: hex.coords, to }))
        )
}

export function legalMovesFor(board: EarendelBoard, playerId: string): Move[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .flatMap((hex) =>
            destinationsFrom(board, hex.coords).map((to) => ({ from: hex.coords, to }))
        )
}
