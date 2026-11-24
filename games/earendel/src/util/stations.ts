import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsThrough } from '../model/board.js'
import { isStationHub, PieceType } from '../model/pieces.js'
import type { StationComplexSummary } from '../model/stationComplex.js'
import { isSightAnchor, sightLinkedStations } from './lineOfSight.js'

// A player's stations and relays joined to the station at coords by touch or by sight, through
// any chain of links. A planet the player has settled is a station that joins by touch alone.
function complexAnchors(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): AxialCoordinates[] {
    // Gates of the owner's join a complex by touch, as one place, though they never score.
    const isOwnAnchor = (at: AxialCoordinates) => {
        if (isColonyOf(board, at, playerId)) return true
        const piece = getHex(board, at)?.piece
        return (
            piece?.playerId === playerId && (isSightAnchor(piece) || piece.type === PieceType.Gate)
        )
    }

    if (!isOwnAnchor(coords) || !isStation(board, coords)) return []

    const seen = new Set<number>([hexKey(coords)])
    const queue: AxialCoordinates[] = [coords]
    const joined: AxialCoordinates[] = []

    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
        joined.push(at)

        const linked = [
            ...neighborsThrough(board, at).filter(isOwnAnchor),
            ...sightLinkedStations(board, at)
        ]

        for (const next of linked) {
            const key = hexKey(next)
            if (seen.has(key)) continue
            seen.add(key)
            queue.push(next)
        }
    }

    return joined
}

function isColonyOf(board: EarendelBoard, at: AxialCoordinates, playerId: string): boolean {
    return getHex(board, at)?.colony === playerId
}

// A station, or a settled planet, which scores as one. Only its owner's complexes reach it.
function isStation(board: EarendelBoard, at: AxialCoordinates): boolean {
    const hex = getHex(board, at)
    return hex?.piece?.type === PieceType.Station || hex?.colony !== undefined
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
        ...(placedHub(board, coords) ? { doubled: true } : {}),
        relays: anchors.filter((at) => pieceAt(at)?.type === PieceType.Relay).length
    }
}

// A Station Hub doubles what its complex pays when it is the station placed, and counts as an
// ordinary station whenever the complex scores afterwards (rules.md, Components).
function placedHub(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const piece = getHex(board, coords)?.piece
    return piece !== undefined && isStationHub(piece)
}

export function stationGroupPoints(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): number {
    const complex = stationComplex(board, playerId, coords)
    return complex.length * (placedHub(board, coords) ? 2 : 1)
}
