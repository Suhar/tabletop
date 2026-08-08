import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { ProbeLevel } from './pieces.js'
import { TechnologyCard } from './technology.js'

// A probe placement waiting on the player who made it. Two decisions can be pending, in
// order: which planet this probe explores (only a real choice when it landed beside more
// than one), and then which of the revealed technologies the planet keeps.
//
// This lives in game state rather than in the client because both steps change authoritative
// state - the reveal consumes the technology deck - and because a disconnect mid-choice must
// not lose the game's place.
export type PendingExploration = Type.Static<typeof PendingExploration>
export const PendingExploration = Type.Object({
    playerId: Type.String(),
    probeCoords: AxialCoordinates,
    probeLevel: Type.Enum(ProbeLevel),
    // The planets this probe could explore. Exactly one will be.
    candidatePlanets: Type.Array(AxialCoordinates),
    // Set once the planet is settled and its cards are face up: the planet being explored,
    // and the matching cards the player is choosing between.
    exploringPlanet: Type.Optional(AxialCoordinates),
    revealed: Type.Optional(Type.Array(TechnologyCard)),
    candidates: Type.Optional(Type.Array(TechnologyCard))
})
