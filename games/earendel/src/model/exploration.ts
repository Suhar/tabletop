import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'
import { PieceLevel } from './pieces.js'

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
