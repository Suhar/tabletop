import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { PlanetColor } from './board.js'

export type ScoredChain = Type.Static<typeof ScoredChain>
export const ScoredChain = Type.Object({
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    color: Type.Enum(PlanetColor),
    length: Type.Number(),
    points: Type.Number()
})
