import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { TechnologyEffectKind } from './technology.js'

// An elevated event being resolved, one player's pick at a time (rules.md, Elevated technologies).
export type PendingEvent = Type.Static<typeof PendingEvent>
export const PendingEvent = Type.Object({
    kind: Type.Enum(TechnologyEffectKind),
    discovererId: Type.String(),
    planet: AxialCoordinates,
    // The players still to pick, in picking order, once the discoverer has set it: the first is
    // whose pick it is. A rule's discoverer picks alone, so their order is set at once.
    order: Type.Optional(Type.Array(Type.String())),
    // Signal Intercept: planets already intercepted, each going once.
    intercepted: Type.Optional(Type.Array(AxialCoordinates)),
    // Shipyard World: what is left of the alien stock, by the technology that grants each unit.
    stock: Type.Optional(Type.Record(Type.String(), Type.Number()))
})
