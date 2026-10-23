import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import { EarendelBoard, HexKind, hexKey, PLANET_COLORS } from '../model/board.js'

// A tile is four hexes in a diamond: an axial rhombus, (0,0) (1,0) (0,1) (1,1) relative to
// its origin. Two of the four are planets and two are open space, but WHICH two varies from
// tile to tile - that variety is the whole reason the board is interesting, so the layout is
// drawn at random per tile rather than fixed.
export const TILE_HEX_OFFSETS: AxialCoordinates[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 }
]

// One planet per tile, three hexes of open space. PROVISIONAL, chosen by simulation rather
// than by feel: two planets per tile left so little room that no game could reach its own
// ending, and dropping to one is what makes the open space add up (see rules.md).
export const PLANETS_PER_TILE = 1

// TESTING VALUE, deliberately too small: three tiles per player gives 9 open hexes each
// against a bag of 22, so the board fills long before anyone empties their bag and games end
// early. That is the point - a short game is a fast way to reach any particular rule.
//
// The playtest value is SEVEN, which simulation picked as the smallest board where games still
// end the way the rules say (see rules.md). The sizing assertions in simulation.test.ts are
// written against 7 for that reason, not against this constant.
export const TILES_PER_PLAYER = 3

// What the board should be for a real game. Kept here so the number isn't lost while the
// testing value is in place.
export const PLAYTEST_TILES_PER_PLAYER = 7

// Both numbers are being tuned, so they can be overridden without editing the constants -
// see simulate.ts, which sweeps them.
export type BoardSetupOptions = {
    tilesPerPlayer?: number
    planetsPerTile?: number
}

// Where the starting tiles go.
//
// Tiles are laid on a grid whose two steps are axis-aligned on screen: in axial terms (2,-1)
// is exactly horizontal and (0,2) exactly vertical, so columns and rows line up rather than
// shearing away as a naive (2,0) step would. Those two steps generate a lattice of index four,
// which is exactly the size of a tile, so the rhombi tile the plane with no gaps or overlaps.
const COLUMN_STEP: AxialCoordinates = { q: 2, r: -1 }
const ROW_STEP: AxialCoordinates = { q: 0, r: 2 }

// How far a column and a row carry on screen, in the units the hexes are drawn in. A tile
// cell is taller than it is wide, which is why a square grid of them would come out portrait.
const COLUMN_WIDTH = 150
const ROW_HEIGHT = 174

// Wider than tall, to sit in an app window rather than fighting it.
const TARGET_ASPECT = 1.6

// The column count whose grid comes out closest to TARGET_ASPECT.
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

// The board every game starts from: TILES_PER_PLAYER per player, each with its own layout.
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
                // Placeholder distribution: each planet's colour drawn independently. How
                // colours should actually be spread across the opening map is still open -
                // an even spread and a clumpy one play very differently.
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
