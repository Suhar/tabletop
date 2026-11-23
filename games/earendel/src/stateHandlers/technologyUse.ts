import type { HydratedAction, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import {
    HydratedUseUpdatedLogistics,
    isUseUpdatedLogistics
} from '../actions/useUpdatedLogistics.js'
import { HydratedUseTacticalFeint, isUseTacticalFeint } from '../actions/useTacticalFeint.js'
import {
    HydratedUseTradeRouteWormhole,
    isUseTradeRouteWormhole
} from '../actions/useTradeRouteWormhole.js'
import { HydratedUseTacticalShift, isUseTacticalShift } from '../actions/useTacticalShift.js'
import { HydratedUseWarpDrive, isUseWarpDrive } from '../actions/useWarpDrive.js'
import { HydratedUseDimensionalRift, isUseDimensionalRift } from '../actions/useDimensionalRift.js'
import {
    HydratedUseBeyondTheFrontier,
    isUseBeyondTheFrontier
} from '../actions/useBeyondTheFrontier.js'
import {
    HydratedUseImmediateDownload,
    isUseImmediateDownload
} from '../actions/useImmediateDownload.js'
import { HydratedUseSpoofedOrders, isUseSpoofedOrders } from '../actions/useSpoofedOrders.js'
import { HydratedUseAsteroidField, isUseAsteroidField } from '../actions/useAsteroidField.js'
import { HydratedUseSecurityBreach, isUseSecurityBreach } from '../actions/useSecurityBreach.js'
import { HydratedUseConscription, isUseConscription } from '../actions/useConscription.js'
import { HydratedUseFactoryOverride, isUseFactoryOverride } from '../actions/useFactoryOverride.js'
import { HydratedUseColonyShip, isUseColonyShip } from '../actions/useColonyShip.js'
import { endPlacement } from '../util/turn.js'

export type TechnologyUse =
    | HydratedUseUpdatedLogistics
    | HydratedUseTacticalFeint
    | HydratedUseTradeRouteWormhole
    | HydratedUseImmediateDownload
    | HydratedUseTacticalShift
    | HydratedUseWarpDrive
    | HydratedUseConscription
    | HydratedUseFactoryOverride
    | HydratedUseColonyShip
    | HydratedUseDimensionalRift
    | HydratedUseBeyondTheFrontier
    | HydratedUseSpoofedOrders
    | HydratedUseAsteroidField
    | HydratedUseSecurityBreach

export function isTechnologyUse(action: HydratedAction): action is TechnologyUse {
    return (
        isUseUpdatedLogistics(action) ||
        isUseTacticalFeint(action) ||
        isUseTradeRouteWormhole(action) ||
        isUseImmediateDownload(action) ||
        isUseTacticalShift(action) ||
        isUseWarpDrive(action) ||
        isUseConscription(action) ||
        isUseFactoryOverride(action) ||
        isUseColonyShip(action) ||
        isUseDimensionalRift(action) ||
        isUseBeyondTheFrontier(action) ||
        isUseSpoofedOrders(action) ||
        isUseAsteroidField(action) ||
        isUseSecurityBreach(action)
    )
}

// Where a turn goes after a technology is used, whether mid-placement or once the ships are down.
export function stateAfterTechnologyUse(
    action: TechnologyUse,
    gameState: HydratedEarendelGameState,
    context: MachineContext<HydratedEarendelGameState>
): MachineState {
    if (isUseUpdatedLogistics(action)) return MachineState.Attacking
    if (isUseBeyondTheFrontier(action)) return MachineState.PlacingTile
    if (isUseImmediateDownload(action)) return endPlacement(gameState, context)
    if (gameState.pendingTerraform) return MachineState.Terraforming
    if (gameState.pendingExploration) return MachineState.Exploring
    if (gameState.pendingAttack) return MachineState.Attacking
    return endPlacement(gameState, context)
}
