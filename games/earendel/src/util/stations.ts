import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsOf } from '../model/board.js'
import { isStationHub, PieceType } from '../model/pieces.js'
import { isSightAnchor, sightLinkedStations } from './lineOfSight.js'

// A player's stations joined to the one at coords by touch or by sight, through their relays as
// well as their stations; only the stations are returned, since only they score.
export function stationComplex(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const isOwnAnchor = (at: AxialCoordinates) => {
        const piece = getHex(board, at)?.piece
        return piece?.playerId === playerId && isSightAnchor(piece)
    }
    const isStation = (at: AxialCoordinates) => getHex(board, at)?.piece?.type === PieceType.Station

    if (!isOwnAnchor(coords) || !isStation(coords)) return []

    const seen = new Set<number>([hexKey(coords)])
    const queue: AxialCoordinates[] = [coords]
    const joined: AxialCoordinates[] = []

    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
        joined.push(at)

        const linked = [...neighborsOf(at).filter(isOwnAnchor), ...sightLinkedStations(board, at)]

        for (const next of linked) {
            const key = hexKey(next)
            if (seen.has(key)) continue
            seen.add(key)
            queue.push(next)
        }
    }

    return joined.filter(isStation)
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
