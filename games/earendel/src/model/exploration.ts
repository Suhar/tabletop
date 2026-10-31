import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { Piece, PieceLevel } from './pieces.js'

export type PendingTechnology = Type.Static<typeof PendingTechnology>
export const PendingTechnology = Type.Object({
    playerId: Type.String(),
    technologyId: Type.String()
})

// Stored, not derived: which planet the probe surveyed is a choice the board does not record.
export type ProbeClaim = Type.Static<typeof ProbeClaim>
export const ProbeClaim = Type.Object({
    playerId: Type.String(),
    coords: AxialCoordinates,
    technologyId: Type.String()
})

// A probe that left the board for a planet's orbit when its claim paid out.
export type OrbitedProbe = Type.Static<typeof OrbitedProbe>
export const OrbitedProbe = Type.Object({
    probe: Piece,
    from: AxialCoordinates,
    planet: AxialCoordinates
})

export type PendingExploration = Type.Static<typeof PendingExploration>
export const PendingExploration = Type.Object({
    playerId: Type.String(),
    probeCoords: AxialCoordinates,
    probeLevel: Type.Enum(PieceLevel),
    candidatePlanets: Type.Array(AxialCoordinates),
    exploringPlanet: Type.Optional(AxialCoordinates),
    revealed: Type.Optional(Type.Array(Type.String())),
    candidates: Type.Optional(Type.Array(Type.String()))
})

// A terraformer just placed beside planets no other terraformer touches: it may recolour one.
export type PendingTerraform = Type.Static<typeof PendingTerraform>
export const PendingTerraform = Type.Object({
    playerId: Type.String(),
    terraformerCoords: AxialCoordinates,
    planets: Type.Array(AxialCoordinates)
})
