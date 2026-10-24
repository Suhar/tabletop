import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsOf } from '../model/board.js'
import { isStationHub, PieceType } from '../model/pieces.js'
import { sightLinkedStations } from './lineOfSight.js'

export function stationComplex(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const isOwnStation = (at: AxialCoordinates) => {
        const piece = getHex(board, at)?.piece
        return piece?.playerId === playerId && piece.type === PieceType.Station
    }

    if (!isOwnStation(coords)) return []

    const seen = new Set<number>([hexKey(coords)])
    const queue: AxialCoordinates[] = [coords]
    const complex: AxialCoordinates[] = []

    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
        complex.push(at)

        const linked = [...neighborsOf(at).filter(isOwnStation), ...sightLinkedStations(board, at)]

        for (const next of linked) {
            const key = hexKey(next)
            if (seen.has(key)) continue
            seen.add(key)
            queue.push(next)
        }
    }

    return complex
}

// Hubs multiply (rules.md, Granted pieces).
export function hubMultiplier(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): number {
    const hubs = stationComplex(board, playerId, coords).filter((at) => {
        const piece = getHex(board, at)?.piece
        return piece !== undefined && isStationHub(piece)
    }).length

    return 2 ** hubs
}

export function stationGroupPoints(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): number {
    const complex = stationComplex(board, playerId, coords)
    return complex.length * hubMultiplier(board, playerId, coords)
}
