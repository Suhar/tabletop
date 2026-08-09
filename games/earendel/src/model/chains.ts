import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { PlanetColor } from './board.js'

// A chain scored by a placement: the two same-coloured planets it joined, how many of the
// player's ships stood between them, and what that paid.
export type ScoredChain = Type.Static<typeof ScoredChain>
export const ScoredChain = Type.Object({
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    color: Type.Enum(PlanetColor),
    // Ships in the chain - planets aren't counted.
    length: Type.Number(),
    points: Type.Number()
})
