import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { PlanetColor } from './board.js'

// A pair of same-colored planets and the player whose chain holds it. A pair carries one route
// at a time, for as long as its owner has a chain joining it (rules.md, Chains and trade routes).
export type TradeRoute = Type.Static<typeof TradeRoute>
export const TradeRoute = Type.Object({
    id: Type.String(),
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    color: Type.Enum(PlanetColor),
    playerId: Type.String(),
    // The shortest run when it was established, and what that paid.
    length: Type.Number(),
    points: Type.Number()
})

// A route as State stores it. Games stored before routes could break hold only the pair and who
// joined it, so the rest is optional here; hydration brings each up to a TradeRoute. One object
// schema, not a union of the two shapes: visibility projection cannot choose between union
// branches that both match.
export type StoredTradeRoute = Type.Static<typeof StoredTradeRoute>
export const StoredTradeRoute = Type.Object({
    planets: Type.Tuple([AxialCoordinates, AxialCoordinates]),
    playerId: Type.String(),
    id: Type.Optional(Type.String()),
    color: Type.Optional(Type.Enum(PlanetColor)),
    length: Type.Optional(Type.Number()),
    points: Type.Optional(Type.Number())
})

// The optional metadata fields every action that can change the board's routes carries.
export const RouteChangeMetadata = {
    routesEstablished: Type.Optional(Type.Array(TradeRoute)),
    routesBroken: Type.Optional(Type.Array(TradeRoute))
}
