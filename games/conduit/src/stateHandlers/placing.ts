import type { HydratedAction, MachineContext, MachineStateHandler } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceTile, isPlaceTile } from '../actions/placeTile.js'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { endTurn, nextResolutionState, placingPlayerId, startTurn } from './flow.js'

export class PlacingStateHandler implements MachineStateHandler<
    HydratedPlaceTile,
    HydratedConduitGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedConduitGameState>
    ): action is HydratedPlaceTile {
        return isPlaceTile(action) && HydratedPlaceTile.canPlaceTile(context.gameState, action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedConduitGameState>
    ): ActionType[] {
        return context.gameState.pendingPlacement()?.playerId === playerId
            ? [ActionType.PlaceTile]
            : []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        const state = context.gameState
        startTurn(state, placingPlayerId(state))
    }

    onAction(
        _action: HydratedPlaceTile,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        endTurn(context.gameState)
        return nextResolutionState(context)
    }
}
