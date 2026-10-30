import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import {
    EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    PLANET_COLORS
} from '../model/board.js'
import { TILE_HEX_OFFSETS } from '../model/tile.js'
import {
    legalTilePlacements,
    TILE_ROTATIONS,
    tileFootprint,
    type TilePlacement
} from './tilePlacement.js'

// One planet per tile, settled by simulation (rules.md, Setup).
export const PLANETS_PER_TILE = 1

export const TILES_PER_PLAYER = 3

export const PLAYTEST_TILES_PER_PLAYER = 7

export type BoardSetupOptions = {
    tilesPerPlayer?: number
    planetsPerTile?: number
}

// Growth weights. Contact keeps the board clustered, spread keeps it growing outward from its
// middle rather than in a line, and an enclosed hole is all but ruled out.
const CONTACT_WEIGHT = 1
const SPREAD_WEIGHT = 2.5
const HOLE_PENALTY = 20
const JITTER = 2.5
// Distance across counts for less than distance down, so boards lean wide like the table.
const WIDTH_BIAS = 1.7

// Hex centres in units of the hex size, flat-topped.
function centreOf({ q, r }: AxialCoordinates): { x: number; y: number } {
    return { x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2) }
}

// The starting tiles, grown one at a time from a single tile: each new tile goes where it
// touches the board most and strays least from its middle, with a seeded nudge so no two boards
// match.
export function startingTilePlacements(tileCount: number, prng: Prng): TilePlacement[] {
    if (tileCount <= 0) return []

    const first: TilePlacement = {
        origin: { q: 0, r: 0 },
        rotation: Math.floor(prng.random() * TILE_ROTATIONS)
    }
    const placements = [first]
    const board: EarendelBoard = { hexes: {} }
    const occupy = (placement: TilePlacement) => {
        for (const coords of tileFootprint(placement.origin, placement.rotation)) {
            board.hexes[hexKey(coords)] = { coords, tileId: '', kind: HexKind.Open }
        }
    }
    occupy(first)

    while (placements.length < tileCount) {
        const hexes = Object.values(board.hexes).map((hex) => centreOf(hex.coords))
        const middle = {
            x: hexes.reduce((sum, c) => sum + c.x, 0) / hexes.length,
            y: hexes.reduce((sum, c) => sum + c.y, 0) / hexes.length
        }
        const distance = (c: { x: number; y: number }) =>
            ((c.x - middle.x) / WIDTH_BIAS) ** 2 + (c.y - middle.y) ** 2
        const radius = hexes.reduce((sum, c) => sum + distance(c), 0) / hexes.length + 1

        let best: { placement: TilePlacement; score: number } | undefined
        for (const placement of legalTilePlacements(board)) {
            const footprint = tileFootprint(placement.origin, placement.rotation)
            const score =
                CONTACT_WEIGHT * contactOf(board, footprint) -
                (SPREAD_WEIGHT * spreadOf(footprint, distance)) / radius -
                HOLE_PENALTY * holesLeftBy(board, footprint) +
                JITTER * prng.random()
            if (!best || score > best.score) best = { placement, score }
        }
        if (!best) break

        placements.push(best.placement)
        occupy(best.placement)
    }

    return placements
}

// Sides the tile would share with the board.
function contactOf(board: EarendelBoard, footprint: AxialCoordinates[]): number {
    return footprint.reduce(
        (sum, coords) =>
            sum + neighborsOf(coords).filter((neighbor) => getHex(board, neighbor)).length,
        0
    )
}

function spreadOf(
    footprint: AxialCoordinates[],
    distance: (c: { x: number; y: number }) => number
): number {
    return footprint.reduce((sum, coords) => sum + distance(centreOf(coords)), 0) / footprint.length
}

// Empty hexes the tile would close in on every side.
function holesLeftBy(board: EarendelBoard, footprint: AxialCoordinates[]): number {
    const filled = new Set(footprint.map(hexKey))
    const isFilled = (coords: AxialCoordinates) =>
        filled.has(hexKey(coords)) || getHex(board, coords) !== undefined

    const around = new Map<number, AxialCoordinates>()
    for (const coords of footprint) {
        for (const neighbor of neighborsOf(coords)) {
            if (!isFilled(neighbor)) around.set(hexKey(neighbor), neighbor)
        }
    }
    return [...around.values()].filter((coords) => neighborsOf(coords).every(isFilled)).length
}

export function buildStartingBoard(
    playerCount: number,
    prng: Prng,
    options: BoardSetupOptions = {}
): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    const tilesPerPlayer = options.tilesPerPlayer ?? TILES_PER_PLAYER
    const planetsPerTile = options.planetsPerTile ?? PLANETS_PER_TILE

    startingTilePlacements(playerCount * tilesPerPlayer, prng).forEach((placement, index) => {
        const tileId = `tile-${index}`
        const kinds = shuffledTileKinds(prng, planetsPerTile)

        tileFootprint(placement.origin, placement.rotation).forEach((coords, hexIndex) => {
            const kind = kinds[hexIndex]
            board.hexes[hexKey(coords)] = {
                coords,
                tileId,
                kind,
                ...(kind === HexKind.Planet
                    ? { color: PLANET_COLORS[Math.floor(prng.random() * PLANET_COLORS.length)] }
                    : {})
            }
        })
    })

    return board
}

function shuffledTileKinds(prng: Prng, planetsPerTile: number): HexKind[] {
    const kinds: HexKind[] = [
        ...Array.from({ length: planetsPerTile }, () => HexKind.Planet),
        ...Array.from({ length: TILE_HEX_OFFSETS.length - planetsPerTile }, () => HexKind.Open)
    ]
    shuffle(kinds, prng.random)
    return kinds
}
