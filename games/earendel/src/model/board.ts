import * as Type from 'typebox'
import {
    AxialCoordinates,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    hexNeighborCoords,
    HexOrientation
} from '@tabletop/common'
import { Piece, powerOf } from './pieces.js'

// The board is hexes, laid down four at a time as diamond-shaped TILES. A hex is either a
// planet or open space; a tile carries two of each. Pieces (ships) occupy a single hex.
//
// State keys hexes by coordinatesToNumber(axial) rather than by a "q,r" string - the same
// choice Kaivai's board makes, and the reason its cells are Record<number, Cell>. A runtime
// HexGrid can always be rebuilt from these when pathfinding or geometry is needed; the
// stored form stays plain data that typebox can validate and the engine can clone.
export const BOARD_ORIENTATION = HexOrientation.Flat

export enum HexKind {
    Planet = 'planet',
    Open = 'open'
}

export type Hex = Type.Static<typeof Hex>
export const Hex = Type.Object({
    // Its own coordinates, even though the hexes record is keyed by them. The key is a
    // Szudzik pairing (see coordinatesToNumber) and libs/common ships no inverse, so
    // carrying the coords is how a hex stays self-describing when iterating - the same
    // choice Kaivai's Cell makes.
    coords: AxialCoordinates,
    // Which tile laid this hex down - kept so the UI can draw tile seams, and so a rule
    // that cares about whole tiles has something to group by.
    tileId: Type.String(),
    kind: Type.Enum(HexKind),
    // The ship standing here, if any. A planet hex is never occupied: ships sit AROUND
    // planets and exert power on them (see planetControl).
    piece: Type.Optional(Piece),
    // Set once a probe has explored this planet. Only meaningful on planet hexes.
    explored: Type.Optional(Type.Boolean())
})

export type EarendelBoard = Type.Static<typeof EarendelBoard>
export const EarendelBoard = Type.Object({
    hexes: Type.Record(Type.Number(), Hex)
})

export function hexKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

export function getHex(board: EarendelBoard, coords: AxialCoordinates): Hex | undefined {
    return board.hexes[hexKey(coords)]
}

// The six hexes touching this one. hexNeighborCoords answers one direction at a time, so
// this walks the clockwise direction set for the board's orientation.
export function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return ClockwiseFlatHexDirections.map((direction) =>
        hexNeighborCoords(coords, BOARD_ORIENTATION, direction)
    )
}

// A hex a ship can be placed on: on the board, not a planet, and unoccupied.
export function isOpenHex(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = getHex(board, coords)
    return hex !== undefined && hex.kind === HexKind.Open && hex.piece === undefined
}

export type PlanetControl = {
    // Every player with power adjacent to the planet, highest first.
    powerByPlayerId: Record<string, number>
    // Who controls it: the players tied for the most power, or empty when no one has any.
    // Ties are NOT broken - each tied player takes the full reward.
    controllingPlayerIds: string[]
    power: number
}

// Control of a planet is decided by the power a player has in the six hexes around it -
// probes contribute nothing, stations 1, fighters 2 (see PIECE_POWER). Ties stand: every
// tied player controls it and scores it in full.
export function planetControl(board: EarendelBoard, coords: AxialCoordinates): PlanetControl {
    const powerByPlayerId: Record<string, number> = {}

    for (const neighbor of neighborsOf(coords)) {
        const piece = getHex(board, neighbor)?.piece
        if (!piece) continue
        powerByPlayerId[piece.playerId] = (powerByPlayerId[piece.playerId] ?? 0) + powerOf(piece.type)
    }

    let power = 0
    for (const value of Object.values(powerByPlayerId)) {
        if (value > power) power = value
    }

    // Zero power controls nothing - a planet ringed only by probes stays unclaimed, which is
    // what makes a probe an explorer rather than a claim.
    const controllingPlayerIds =
        power > 0 ? Object.keys(powerByPlayerId).filter((playerId) => powerByPlayerId[playerId] === power) : []

    return { powerByPlayerId, controllingPlayerIds, power }
}

export function planetCoordinates(board: EarendelBoard): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Planet)
        .map((hex) => hex.coords)
}
