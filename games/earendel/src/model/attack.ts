import * as Type from 'typebox'
import { AxialCoordinates } from '@tabletop/common'

// A fighter that has just landed next to something it could destroy, waiting on its owner.
// Destroying is optional, so this is a real decision even when there is only one target -
// unlike the exploration choices, it is never taken on the player's behalf.
export type PendingAttack = Type.Static<typeof PendingAttack>
export const PendingAttack = Type.Object({
    playerId: Type.String(),
    fighterCoords: AxialCoordinates,
    // Adjacent hexes holding an opponent's weaker piece. Exactly one may be destroyed.
    targets: Type.Array(AxialCoordinates)
})
