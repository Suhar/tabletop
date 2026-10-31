import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
import { endPlacement } from '../util/turn.js'

// A terraformer has just arrived beside a planet it may recolour.
export class TerraformingStateHandler implements MachineStateHandler<
    HydratedTerraform,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is HydratedTerraform {
        if (!action.playerId) return false
        return this.validActionsForPlayer(action.playerId, context).some(
            (actionType) => actionType === action.type
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return context.gameState.pendingTerraform?.playerId === playerId
            ? [ActionType.Terraform]
            : []
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const pending = context.gameState.pendingTerraform
        if (pending) context.gameState.activePlayerIds = [pending.playerId]
    }

    onAction(
        action: HydratedTerraform,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        if (!isTerraform(action)) throw Error('Invalid action type')
        return endPlacement(context.gameState, context, action)
    }
}
