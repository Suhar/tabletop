import { sameCoordinates } from '@tabletop/common'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsThrough } from '../model/board.js'
import { connectedGroup } from './groups.js'

export function planetPairKey(a: AxialCoordinates, b: AxialCoordinates): string {
    return [hexKey(a), hexKey(b)].sort((left, right) => left - right).join(':')
}

function componentContaining(
    board: EarendelBoard,
    playerId: string,
    start: AxialCoordinates
): AxialCoordinates[] {
    return connectedGroup(board, start, (hex) => hex.piece?.playerId === playerId)
}

function chainLength(
    board: EarendelBoard,
    component: AxialCoordinates[],
    from: AxialCoordinates,
    to: AxialCoordinates
): number | undefined {
    const inComponent = new Set(component.map(hexKey))
    const touches = (coords: AxialCoordinates, planet: AxialCoordinates) =>
        neighborsThrough(board, coords).some((neighbor) => sameCoordinates(neighbor, planet))

    const reached = new Set<number>()
    const queue: { coords: AxialCoordinates; distance: number }[] = []

    for (const coords of component) {
        if (touches(coords, from)) {
            reached.add(hexKey(coords))
            queue.push({ coords, distance: 1 })
        }
    }

    for (let step = queue.shift(); step !== undefined; step = queue.shift()) {
        const { coords, distance } = step
        if (touches(coords, to)) return distance

        for (const neighbor of neighborsThrough(board, coords)) {
            const key = hexKey(neighbor)
            if (!inComponent.has(key) || reached.has(key)) continue
            reached.add(key)
            queue.push({ coords: neighbor, distance: distance + 1 })
        }
    }

    return undefined
}

// The shortest run of the player's own ships joining the two planets, if they have one.
export function chainLengthBetween(
    board: EarendelBoard,
    playerId: string,
    from: AxialCoordinates,
    to: AxialCoordinates
): number | undefined {
    const lengths = neighborsThrough(board, from)
        .filter((coords) => getHex(board, coords)?.piece?.playerId === playerId)
        .map((coords) => chainLength(board, componentContaining(board, playerId, coords), from, to))
        .filter((length) => length !== undefined)
    return lengths.length > 0 ? Math.min(...lengths) : undefined
}
