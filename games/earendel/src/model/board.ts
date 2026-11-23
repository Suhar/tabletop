import * as Type from 'typebox'
import {
    AxialCoordinates,
    ClockwiseFlatHexDirections,
    coordinatesToNumber,
    hexNeighborCoords,
    HexOrientation
} from '@tabletop/common'
import { Piece, PieceType, powerOf } from './pieces.js'
import { PlanetColor } from './planetColor.js'

// Re-exported for existing importers; defined in planetColor.ts to keep board and technology
// acyclic.
export { PlanetColor, PLANET_COLORS } from './planetColor.js'

export const BOARD_ORIENTATION = HexOrientation.Flat

export enum HexKind {
    Planet = 'planet',
    Open = 'open',
    // Laid by a nebula seeder: nothing is placed on it, moves through it or sees past it.
    Nebula = 'nebula'
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
    orbiters: Type.Optional(Type.Array(Piece)),
    // A planet settled by a Colony Ship: it counts as a station of this player's for the
    // complexes beside it, for the rest of the game (rules.md, One-shot technologies).
    colony: Type.Optional(Type.String())
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

// The other gate of the pair the gate at coords belongs to, when both stand on the board.
export function gateTwin(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates | undefined {
    const gate = getHex(board, coords)?.piece
    if (gate?.type !== PieceType.Gate || !gate.pairId) return undefined
    return Object.values(board.hexes).find(
        (hex) =>
            hex.piece?.type === PieceType.Gate &&
            hex.piece.pairId === gate.pairId &&
            hex.piece.playerId === gate.playerId &&
            hexKey(hex.coords) !== hexKey(coords)
    )?.coords
}

// A hex's neighbors as the rules that cross gates see them: a gate pair is one place, so what
// stands beside one gate stands beside the other (rules.md, Gate Network). Attacks, torpedoes
// and planet control use plain neighbors.
export function neighborsThrough(
    board: EarendelBoard,
    coords: AxialCoordinates
): AxialCoordinates[] {
    const plain = neighborsOf(coords)
    const seen = new Set(plain.map(hexKey))
    seen.add(hexKey(coords))
    const through: AxialCoordinates[] = [...plain]
    const extend = (gate: AxialCoordinates) => {
        const twin = gateTwin(board, gate)
        if (!twin) return
        for (const beyond of [twin, ...neighborsOf(twin)]) {
            const key = hexKey(beyond)
            if (seen.has(key)) continue
            seen.add(key)
            through.push(beyond)
        }
    }
    // Standing on a gate, or beside one, reaches what is beside its twin.
    if (getHex(board, coords)?.piece?.type === PieceType.Gate) extend(coords)
    for (const neighbor of plain) {
        if (getHex(board, neighbor)?.piece?.type === PieceType.Gate) extend(neighbor)
    }
    return through
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
