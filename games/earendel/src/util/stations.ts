import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsOf } from '../model/board.js'
import { isStationHub, PieceType } from '../model/pieces.js'
import type { StationComplexSummary } from '../model/stationComplex.js'
import { isSightAnchor, sightLinkedStations } from './lineOfSight.js'

// A player's stations and relays joined to the station at coords by touch or by sight, through
// any chain of links.
function complexAnchors(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const isOwnAnchor = (at: AxialCoordinates) => {
        const piece = getHex(board, at)?.piece
        return piece?.playerId === playerId && isSightAnchor(piece)
    }

    if (!isOwnAnchor(coords) || !isStation(board, coords)) return []

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

    return joined
}

function isStation(board: EarendelBoard, at: AxialCoordinates): boolean {
    return getHex(board, at)?.piece?.type === PieceType.Station
}

// The stations of the complex at coords; its relays link it but only stations score.
export function stationComplex(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    return complexAnchors(board, playerId, coords).filter((at) => isStation(board, at))
}

export function stationComplexSummary(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): StationComplexSummary {
    const anchors = complexAnchors(board, playerId, coords)
    const pieceAt = (at: AxialCoordinates) => getHex(board, at)?.piece
    return {
        stations: anchors.filter((at) => isStation(board, at)).length,
        hubs: anchors.filter((at) => {
            const piece = pieceAt(at)
            return piece !== undefined && isStationHub(piece)
        }).length,
        relays: anchors.filter((at) => pieceAt(at)?.type === PieceType.Relay).length
    }
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
