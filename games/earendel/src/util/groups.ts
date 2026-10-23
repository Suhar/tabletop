import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, type Hex, hexKey, neighborsOf } from '../model/board.js'

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
