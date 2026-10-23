import { type AxialCoordinates, Prng, shuffle } from '@tabletop/common'
import {
    type EarendelBoard,
    getHex,
    HexKind,
    hexKey,
    neighborsOf,
    PLANET_COLORS
} from '../model/board.js'
import type { Tile } from '../model/tile.js'
import { TILE_HEX_OFFSETS } from './boardSetup.js'

// Tiles held back from the starting map, to be laid during play by the technology that grows
// the board.
//
// Two per player: enough that growth is a real option without the board being able to double.
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

// A tile may be laid in any of six rotations. Rotating 60 degrees about a hex is
// (q, r) -> (-r, q + r); the sets below are the base offsets turned that many times, each
// still anchored on (0,0) so the origin is always one of the tile's own hexes.
//
// The rhombus is symmetric under a half turn, so rotations 0 and 3 (and 1/4, 2/5) cover the
// same four hexes. They are still different placements: the planet ends up in the opposite
// corner, which is the whole point of turning it.
export const TILE_ROTATIONS = 6

export const TILE_OFFSETS_BY_ROTATION: AxialCoordinates[][] = Array.from(
    { length: TILE_ROTATIONS },
    (_unused, rotation) => {
        let offsets = TILE_HEX_OFFSETS
        for (let turn = 0; turn < rotation; turn++) {
            offsets = offsets.map((offset) => ({ q: -offset.r, r: offset.q + offset.r }))
        }
        return offsets
    }
)

export function tileOffsets(rotation = 0): AxialCoordinates[] {
    return TILE_OFFSETS_BY_ROTATION[((rotation % TILE_ROTATIONS) + TILE_ROTATIONS) % TILE_ROTATIONS]
}

// The four hexes a tile laid at this origin, turned this far, would occupy.
export function tileFootprint(origin: AxialCoordinates, rotation = 0): AxialCoordinates[] {
    return tileOffsets(rotation).map((offset) => ({
        q: origin.q + offset.q,
        r: origin.r + offset.r
    }))
}

export type TilePlacement = { origin: AxialCoordinates; rotation: number }

// Whether a tile can be laid here: every hex it would cover must be empty space off the
// current board, and at least two of them must touch a hex already on it.
//
// Two rather than one is what stops the map growing a thin tail - a tile has to be tucked
// against the existing shape rather than hung off a single corner.
export function canPlaceTileAt(
    board: EarendelBoard,
    origin: AxialCoordinates,
    rotation = 0
): boolean {
    const footprint = tileFootprint(origin, rotation)

    if (footprint.some((coords) => getHex(board, coords) !== undefined)) return false

    const touching = footprint.filter((coords) =>
        neighborsOf(coords).some((neighbor) => getHex(board, neighbor) !== undefined)
    )

    return touching.length >= 2
}

// Every way a tile could be laid: an origin and a rotation. Built outward from the hexes
// already on the board, since a legal tile has to touch two of them - so nowhere else is
// worth considering.
export function legalTilePlacements(board: EarendelBoard): TilePlacement[] {
    const candidates = new Map<string, TilePlacement>()

    for (const hex of Object.values(board.hexes)) {
        for (const neighbor of neighborsOf(hex.coords)) {
            for (let rotation = 0; rotation < TILE_ROTATIONS; rotation++) {
                // Any of the tile's four hexes could be the one that lands on this neighbour,
                // so try each offset as that hex and work back to the origin.
                for (const offset of tileOffsets(rotation)) {
                    const origin = { q: neighbor.q - offset.q, r: neighbor.r - offset.r }
                    candidates.set(`${hexKey(origin)}:${rotation}`, { origin, rotation })
                }
            }
        }
    }

    return [...candidates.values()].filter((placement) =>
        canPlaceTileAt(board, placement.origin, placement.rotation)
    )
}

// Lays the tile down, turning it into four hexes on the board.
export function placeTileOnBoard(
    board: EarendelBoard,
    tile: Tile,
    origin: AxialCoordinates,
    rotation = 0
) {
    // planetOffset indexes the tile's own hexes, and rotation permutes where those hexes
    // land - so the planet turns with the tile without any special handling.
    tileFootprint(origin, rotation).forEach((coords, index) => {
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
