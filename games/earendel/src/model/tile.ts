import * as Type from 'typebox'
import { PlanetColor } from './board.js'

// A tile waiting in the supply, described rather than placed: which of its four hexes is the
// planet, and what colour that planet is. It becomes real hexes only when someone lays it.
export type Tile = Type.Static<typeof Tile>
export const Tile = Type.Object({
    id: Type.String(),
    // Index into TILE_HEX_OFFSETS. The other three hexes are open space.
    planetOffset: Type.Number(),
    color: Type.Enum(PlanetColor)
})
