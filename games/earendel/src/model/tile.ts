import * as Type from 'typebox'
import type { AxialCoordinates } from '@tabletop/common'
import { PlanetColor } from './board.js'

// A tile's four hexes, unrotated, relative to its origin.
export const TILE_HEX_OFFSETS: AxialCoordinates[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 }
]

export type Tile = Type.Static<typeof Tile>
export const Tile = Type.Object({
    id: Type.String(),
    planetOffset: Type.Number(),
    color: Type.Enum(PlanetColor)
})
