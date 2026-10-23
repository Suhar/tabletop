import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'

export type PendingAttack = Type.Static<typeof PendingAttack>
export const PendingAttack = Type.Object({
    playerId: Type.String(),
    fighterCoords: AxialCoordinates,
    targets: Type.Array(AxialCoordinates)
})
