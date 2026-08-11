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

// Where the starting tiles go. Tiles are 2 wide and 2 tall in axial terms, so stepping the
// origin by 2 lays them edge to edge with no gaps and no overlap. They spiral outward from
// the centre so that 4 tiles (2 players) and 10 tiles (5 players) both make a compact board
// rather than a long strip.
//
// This is a placeholder arrangement, not a rule: the shape of the starting map is exactly the
// sort of thing to tune once the game is played, and only this function has to change.
export function startingTileOrigins(tileCount: number): AxialCoordinates[] {
    const origins: AxialCoordinates[] = [{ q: 0, r: 0 }]
    // Tile-space directions, scaled to the 2x2 footprint of a tile.
    const steps: AxialCoordinates[] = [
        { q: 2, r: 0 },
        { q: 0, r: 2 },
        { q: -2, r: 2 },
        { q: -2, r: 0 },
        { q: 0, r: -2 },
        { q: 2, r: -2 }
    ]

    let ring = 1
    while (origins.length < tileCount) {
        let coords: AxialCoordinates = { q: steps[4].q * ring, r: steps[4].r * ring }
        for (let side = 0; side < 6 && origins.length < tileCount; side++) {
            for (let step = 0; step < ring && origins.length < tileCount; step++) {
                origins.push(coords)
                coords = { q: coords.q + steps[side].q, r: coords.r + steps[side].r }
            }
        }
        ring++
    }

    return origins.slice(0, tileCount)
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
    const kinds = [
        ...Array(planetsPerTile).fill(HexKind.Planet),
        ...Array(TILE_HEX_OFFSETS.length - planetsPerTile).fill(HexKind.Open)
    ] as HexKind[]
    shuffle(kinds, prng.random)
    return kinds
}
