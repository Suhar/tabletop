import * as Type from 'typebox'
import {
    AxialCoordinates,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    hexNeighborCoords,
    HexOrientation
} from '@tabletop/common'
import { Piece, powerOf } from './pieces.js'
import { PlanetColor } from './planetColor.js'

// Re-exported for existing importers; defined in planetColor.ts to keep board and technology
// acyclic.
export { PlanetColor, PLANET_COLORS } from './planetColor.js'

export const BOARD_ORIENTATION = HexOrientation.Flat

export enum HexKind {
    Planet = 'planet',
    Open = 'open'
}

export type Hex = Type.Static<typeof Hex>
export const Hex = Type.Object({
    // Carried alongside the key: libs/common has no inverse of coordinatesToNumber.
    coords: AxialCoordinates,
    tileId: Type.String(),
    kind: Type.Enum(HexKind),
    color: Type.Optional(Type.Enum(PlanetColor)),
    technologyId: Type.Optional(Type.String()),
    piece: Type.Optional(Piece),
    explored: Type.Optional(Type.Boolean()),
    // Probes spent researching this planet, out of the game (rules.md, Gaining a technology).
    orbiters: Type.Optional(Type.Array(Piece))
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

export const HEX_STEPS: AxialCoordinates[] = ClockwiseFlatHexDirections.map((direction) =>
    hexNeighborCoords({ q: 0, r: 0 }, BOARD_ORIENTATION, direction)
)

export function neighborsOf(coords: AxialCoordinates): AxialCoordinates[] {
    return HEX_STEPS.map((step) => ({ q: coords.q + step.q, r: coords.r + step.r }))
}

export function isOpenHex(board: EarendelBoard, coords: AxialCoordinates): boolean {
    const hex = getHex(board, coords)
    return hex !== undefined && hex.kind === HexKind.Open && hex.piece === undefined
}

export function hasOpenHex(board: EarendelBoard): boolean {
    return Object.values(board.hexes).some(
        (hex) => hex.kind === HexKind.Open && hex.piece === undefined
    )
}

export type PlanetControl = {
    powerByPlayerId: Record<string, number>
    // Ties are not broken: each tied player scores in full (rules.md, Control and scoring).
    controllingPlayerIds: string[]
    power: number
}

export function planetControl(board: EarendelBoard, coords: AxialCoordinates): PlanetControl {
    const powerByPlayerId: Record<string, number> = {}

    for (const neighbor of neighborsOf(coords)) {
        const piece = getHex(board, neighbor)?.piece
        if (!piece) continue
        powerByPlayerId[piece.playerId] = (powerByPlayerId[piece.playerId] ?? 0) + powerOf(piece)
    }

    let power = 0
    for (const value of Object.values(powerByPlayerId)) {
        if (value > power) power = value
    }

    const controllingPlayerIds =
        power > 0
            ? Object.keys(powerByPlayerId).filter((playerId) => powerByPlayerId[playerId] === power)
            : []

    return { powerByPlayerId, controllingPlayerIds, power }
}

export function dominantPlayerId(
    board: EarendelBoard,
    coords: AxialCoordinates
): string | undefined {
    const { controllingPlayerIds } = planetControl(board, coords)
    return controllingPlayerIds.length === 1 ? controllingPlayerIds[0] : undefined
}

export function planetCoordinates(board: EarendelBoard): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.kind === HexKind.Planet)
        .map((hex) => hex.coords)
}
