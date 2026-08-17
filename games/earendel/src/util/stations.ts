import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, getHex, hexKey, neighborsOf } from '../model/board.js'
import { isStationHub, PieceType } from '../model/pieces.js'
import { sightLinkedStations } from './lineOfSight.js'

// The station complex this station belongs to: every station of the same player reachable
// from it, by either kind of link.
//
// Two stations are linked if they TOUCH, or if there is a clear line between them - the wavy
// line that also closes that space to enemy probes. Links are transitive, so a complex can
// span the board in a chain of adjacency and sight lines, and a single station bridging two
// clusters welds them into one.
//
// Note what does NOT link: a probe or fighter standing between two stations breaks both kinds
// at once. It breaks adjacency by definition, and it breaks the line by standing in it. So one
// piece dropped into the gap can split a complex in two - which is the counter-play, given
// stations cannot be destroyed.
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

    while (queue.length > 0) {
        const at = queue.shift()!
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

// How much a complex's score is multiplied by: each Station Hub standing in it doubles the
// payout, from the moment it is placed and every time the complex is scored afterwards.
//
// Hubs multiply, so two in one complex quadruple it - settled, not assumed. That is what
// "doubles the score of its station cluster" says of each hub taken on its own, and the steep
// climb is the point: a hub is won from a technology rather than drawn from the bag, so
// concentrating two in one complex should beat spreading them thin. See rules.md.
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

// What placing a station on this hex pays: one for itself, and one for every other station in
// the complex it joins, doubled for each Station Hub standing in it.
//
// Because it is scored on every placement, a complex built up one station at a time pays 1, 2,
// 3, ... - the same triangular total a chain pays, but earned incrementally. Sight lines make
// that reach much further than adjacency alone: a station laid across the board from three
// others, with a clear line to one of them, still scores 4.
export function stationGroupPoints(
    board: EarendelBoard,
    playerId: string,
    coords: AxialCoordinates
): number {
    const complex = stationComplex(board, playerId, coords)
    return complex.length * hubMultiplier(board, playerId, coords)
}
