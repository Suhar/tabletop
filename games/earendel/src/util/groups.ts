import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, type Hex, hexKey, neighborsOf } from '../model/board.js'

// Every hex reachable from `start` through hexes the predicate accepts, including `start`
// itself. Empty when `start` isn't accepted.
//
// Planets are never occupied, so anything built on pieces treats a planet as a wall: a group
// goes around one, never through it.
export function connectedGroup(
    board: EarendelBoard,
    start: AxialCoordinates,
    includes: (hex: Hex) => boolean
): AxialCoordinates[] {
    const startHex = getHex(board, start)
    if (!startHex || !includes(startHex)) return []

    const seen = new Set<number>([hexKey(start)])
    const queue: AxialCoordinates[] = [start]
    const group: AxialCoordinates[] = []

    while (queue.length > 0) {
        const coords = queue.shift()!
        group.push(coords)

        for (const neighbor of neighborsOf(coords)) {
            const key = hexKey(neighbor)
            if (seen.has(key)) continue

            const hex = board.hexes[key]
            if (!hex || !includes(hex)) continue

            seen.add(key)
            queue.push(neighbor)
        }
    }

    return group
}
