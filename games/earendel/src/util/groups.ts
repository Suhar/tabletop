import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, type Hex, hexKey, neighborsThrough } from '../model/board.js'

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

    for (let coords = queue.shift(); coords !== undefined; coords = queue.shift()) {
        group.push(coords)

        for (const neighbor of neighborsThrough(board, coords)) {
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
