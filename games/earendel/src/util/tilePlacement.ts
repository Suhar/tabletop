import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import { type EarendelBoard, getHex, HexKind, hexKey, neighborsOf, PLANET_COLORS } from '../model/board.js'
import type { Tile } from '../model/tile.js'
import { TILE_HEX_OFFSETS } from './boardSetup.js'

// Tiles held back from the starting map, to be laid during play by the technology that grows
// the board.
//
// PROVISIONAL: two per player. Enough that growth is a real option without the board being
// able to double. The right number depends on how common the technology turns out to be.
export const SPARE_TILES_PER_PLAYER = 2

export function buildTileSupply(playerCount: number, prng: Prng): Tile[] {
    const supply: Tile[] = Array.from(
        { length: playerCount * SPARE_TILES_PER_PLAYER },
        (_unused, index) => ({
            id: `spare-tile-${index}`,
            planetOffset: Math.floor(prng.random() * TILE_HEX_OFFSETS.length),
            color: PLANET_COLORS[Math.floor(prng.random() * PLANET_COLORS.length)]
        })
    )

    shuffle(supply, prng.random)
    return supply
}

// The four hexes a tile laid at this origin would occupy.
export function tileFootprint(origin: AxialCoordinates): AxialCoordinates[] {
    return TILE_HEX_OFFSETS.map((offset) => ({ q: origin.q + offset.q, r: origin.r + offset.r }))
}

// Whether a tile can be laid here: every hex it would cover must be empty space off the
// current board, and at least two of them must touch a hex already on it.
//
// Two rather than one is what stops the map growing a thin tail - a tile has to be tucked
// against the existing shape rather than hung off a single corner.
export function canPlaceTileAt(board: EarendelBoard, origin: AxialCoordinates): boolean {
    const footprint = tileFootprint(origin)

    if (footprint.some((coords) => getHex(board, coords) !== undefined)) return false

    const touching = footprint.filter((coords) =>
        neighborsOf(coords).some((neighbor) => getHex(board, neighbor) !== undefined)
    )

    return touching.length >= 2
}

// Every origin a tile could be laid at. Built outward from the hexes already on the board,
// since a legal tile has to touch two of them - so nowhere else is worth considering.
export function legalTileOrigins(board: EarendelBoard): AxialCoordinates[] {
    const candidates = new Map<number, AxialCoordinates>()

    for (const hex of Object.values(board.hexes)) {
        for (const neighbor of neighborsOf(hex.coords)) {
            // Any of the tile's four hexes could be the one touching this neighbour, so try
            // each offset as the one that lands there.
            for (const offset of TILE_HEX_OFFSETS) {
                const origin = { q: neighbor.q - offset.q, r: neighbor.r - offset.r }
                candidates.set(hexKey(origin), origin)
            }
        }
    }

    return [...candidates.values()].filter((origin) => canPlaceTileAt(board, origin))
}

// Lays the tile down, turning it into four hexes on the board.
export function placeTileOnBoard(board: EarendelBoard, tile: Tile, origin: AxialCoordinates) {
    tileFootprint(origin).forEach((coords, index) => {
        const isPlanet = index === tile.planetOffset
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: tile.id,
            kind: isPlanet ? HexKind.Planet : HexKind.Open,
            ...(isPlanet ? { color: tile.color } : {})
        }
    })
}

// The hexes of a laid tile that a ship could stand on.
export function openHexesOfTile(board: EarendelBoard, tileId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.tileId === tileId && hex.kind === HexKind.Open && !hex.piece)
        .map((hex) => hex.coords)
}
