import * as Type from 'typebox'
import { PlanetColor } from './board.js'

export type Tile = Type.Static<typeof Tile>
export const Tile = Type.Object({
    id: Type.String(),
    planetOffset: Type.Number(),
    color: Type.Enum(PlanetColor)
})
