import type { AxialCoordinates } from '@tabletop/common'
import {
    type EarendelBoard,
    type Hex,
    getHex,
    HexKind,
    isOpenHex,
    neighborsOf,
    sameHex
} from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { probeBlockedBy } from './lineOfSight.js'

export function planetsBeside(board: EarendelBoard, coords: AxialCoordinates): Hex[] {
    return neighborsOf(coords)
        .map((neighbor) => getHex(board, neighbor))
        .filter((hex): hex is Hex => hex?.kind === HexKind.Planet && hex.color !== undefined)
}

export function wormholeDestinations(
    board: EarendelBoard,
    from: AxialCoordinates,
    playerId: string
): AxialCoordinates[] {
    const piece = getHex(board, from)?.piece
    if (!piece || piece.playerId !== playerId) return []

    const sources = planetsBeside(board, from)
    if (sources.length === 0) return []

    return Object.values(board.hexes)
        .filter((hex) => isOpenHex(board, hex.coords))
        .filter((hex) =>
            planetsBeside(board, hex.coords).some((destination) =>
                sources.some(
                    (source) =>
                        !sameHex(source.coords, destination.coords) &&
                        source.color === destination.color
                )
            )
        )
        .filter(
            (hex) => piece.type !== PieceType.Probe || !probeBlockedBy(board, hex.coords, playerId)
        )
        .map((hex) => hex.coords)
}

export function wormholableShips(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .map((hex) => hex.coords)
        .filter((coords) => wormholeDestinations(board, coords, playerId).length > 0)
}
