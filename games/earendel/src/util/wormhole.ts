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

// The planets a hex touches. A hex has six neighbours, so a ship can easily sit beside two or
// three at once - which is what makes a wormhole hop worth thinking about rather than obvious.
export function planetsBeside(board: EarendelBoard, coords: AxialCoordinates): Hex[] {
    return neighborsOf(coords)
        .map((neighbor) => getHex(board, neighbor))
        .filter((hex): hex is Hex => hex?.kind === HexKind.Planet && hex.color !== undefined)
}

// Where a Trade Route Wormhole could send this ship: an empty hex beside a DIFFERENT planet of
// the same colour as one the ship is beside now.
//
// The pair of planets is not part of the move. A ship beside two planets has two colours to
// travel on, and a destination is legal if ANY source planet pairs with ANY planet beside it -
// so the player picks a hex, not a route, and nothing has to be said about which planet they had
// in mind. The rule is about the colour being present at both ends.
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
                        // A different planet, not merely a different hex to look at it from: the
                        // colour is the route, and a route has to go somewhere.
                        !sameHex(source.coords, destination.coords) &&
                        source.color === destination.color
                )
            )
        )
        // Unlike a Tactical Feint, this lands on an EMPTY hex - so "as if newly placed" has a
        // placement rule to answer to, and a station blockade shuts a probe out of the corridor
        // exactly as it would if the probe were being played from hand.
        .filter(
            (hex) =>
                piece.type !== PieceType.Probe || !probeBlockedBy(board, hex.coords, playerId)
        )
        .map((hex) => hex.coords)
}

// The player's ships that could travel at all: beside a planet, with somewhere to go.
export function wormholableShips(board: EarendelBoard, playerId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .map((hex) => hex.coords)
        .filter((coords) => wormholeDestinations(board, coords, playerId).length > 0)
}
