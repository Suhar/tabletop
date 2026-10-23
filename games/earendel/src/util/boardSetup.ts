import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import { EarendelBoard, HexKind, hexKey, PLANET_COLORS } from '../model/board.js'

export const TILE_HEX_OFFSETS: AxialCoordinates[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 }
]

// One planet per tile, settled by simulation (rules.md, Setup).
export const PLANETS_PER_TILE = 1

export const TILES_PER_PLAYER = 3

export const PLAYTEST_TILES_PER_PLAYER = 7

export type BoardSetupOptions = {
    tilesPerPlayer?: number
    planetsPerTile?: number
}

// (2,-1) and (0,2) are axis-aligned on screen and span an index-4 lattice, so the four-hex tiles
// cover the plane with no gaps or overlaps.
const COLUMN_STEP: AxialCoordinates = { q: 2, r: -1 }
const ROW_STEP: AxialCoordinates = { q: 0, r: 2 }

const COLUMN_WIDTH = 150
const ROW_HEIGHT = 174

const TARGET_ASPECT = 1.6

function bestColumnCount(tileCount: number): number {
    let best = 1
    let bestError = Infinity

    for (let columns = 1; columns <= tileCount; columns++) {
        const rows = Math.ceil(tileCount / columns)
        const aspect = (columns * COLUMN_WIDTH) / (rows * ROW_HEIGHT)
        const error = Math.abs(aspect - TARGET_ASPECT)
        if (error < bestError) {
            bestError = error
            best = columns
        }
    }

    return best
}

export function startingTileOrigins(tileCount: number): AxialCoordinates[] {
    const columns = bestColumnCount(tileCount)

    return Array.from({ length: tileCount }, (_unused, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        return {
            q: COLUMN_STEP.q * column + ROW_STEP.q * row,
            r: COLUMN_STEP.r * column + ROW_STEP.r * row
        }
    })
}

export function buildStartingBoard(
    playerCount: number,
    prng: Prng,
    options: BoardSetupOptions = {}
): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    const tilesPerPlayer = options.tilesPerPlayer ?? TILES_PER_PLAYER
    const planetsPerTile = options.planetsPerTile ?? PLANETS_PER_TILE

    startingTileOrigins(playerCount * tilesPerPlayer).forEach((origin, index) => {
        const tileId = `tile-${index}`
        const kinds = shuffledTileKinds(prng, planetsPerTile)

        TILE_HEX_OFFSETS.forEach((offset, hexIndex) => {
            const coords = { q: origin.q + offset.q, r: origin.r + offset.r }
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
