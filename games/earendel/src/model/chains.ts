import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { PlanetColor } from './board.js'

// A pair of same-coloured planets joined by a chain, and the player who joined it. Each pair pays
// once, ever (rules.md, Chains).
export type TradeRoute = Type.Static<typeof TradeRoute>
export const TradeRoute = Type.Object({
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    playerId: Type.String()
})

export type ScoredChain = Type.Static<typeof ScoredChain>
export const ScoredChain = Type.Object({
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    color: Type.Enum(PlanetColor),
    length: Type.Number(),
    points: Type.Number()
})
