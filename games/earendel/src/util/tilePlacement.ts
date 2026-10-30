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
import { TILE_HEX_OFFSETS } from '../model/tile.js'

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

// Rotating 60 degrees about a hex is (q, r) -> (-r, q + r).
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

export function tileFootprint(origin: AxialCoordinates, rotation = 0): AxialCoordinates[] {
    return tileOffsets(rotation).map((offset) => ({
        q: origin.q + offset.q,
        r: origin.r + offset.r
    }))
}

export type TilePlacement = { origin: AxialCoordinates; rotation: number }

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

export function legalTilePlacements(board: EarendelBoard): TilePlacement[] {
    const candidates = new Map<string, TilePlacement>()

    for (const hex of Object.values(board.hexes)) {
        for (const neighbor of neighborsOf(hex.coords)) {
            for (let rotation = 0; rotation < TILE_ROTATIONS; rotation++) {
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

export function placeTileOnBoard(
    board: EarendelBoard,
    tile: Tile,
    origin: AxialCoordinates,
    rotation = 0
) {
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

export function openHexesOfTile(board: EarendelBoard, tileId: string): AxialCoordinates[] {
    return Object.values(board.hexes)
        .filter((hex) => hex.tileId === tileId && hex.kind === HexKind.Open && !hex.piece)
        .map((hex) => hex.coords)
}
