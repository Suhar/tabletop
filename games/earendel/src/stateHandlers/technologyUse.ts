import type { MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import {
    HydratedUseUpdatedLogistics,
    isUseUpdatedLogistics
} from '../actions/useUpdatedLogistics.js'
import { HydratedUseTacticalFeint } from '../actions/useTacticalFeint.js'
import { HydratedUseTradeRouteWormhole } from '../actions/useTradeRouteWormhole.js'
import {
    HydratedUseImmediateDownload,
    isUseImmediateDownload
} from '../actions/useImmediateDownload.js'
import { endPlacement, pendingTechnologyEffectState } from '../util/turn.js'

export type TechnologyUse =
    | HydratedUseUpdatedLogistics
    | HydratedUseTacticalFeint
    | HydratedUseTradeRouteWormhole
    | HydratedUseImmediateDownload

// Where a turn goes after a technology is used, whether mid-placement or once the ships are down.
export function stateAfterTechnologyUse(
    action: TechnologyUse,
    gameState: HydratedEarendelGameState,
    context: MachineContext<HydratedEarendelGameState>
): MachineState {
    if (isUseUpdatedLogistics(action)) return MachineState.Attacking
    if (isUseImmediateDownload(action)) {
        return pendingTechnologyEffectState(gameState) ?? endPlacement(gameState, context, action)
    }
    if (gameState.pendingTerraform) return MachineState.Terraforming
    if (gameState.pendingExploration) return MachineState.Exploring
    if (gameState.pendingAttack) return MachineState.Attacking
    return endPlacement(gameState, context, action)
}
