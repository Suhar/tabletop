import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedFoundPlanet, isFoundPlanet } from '../actions/foundPlanet.js'
import { endPlacement } from '../util/turn.js'

// An artificial planet has just been placed and waits for its color.
export class FoundingPlanetStateHandler implements MachineStateHandler<
    HydratedFoundPlanet,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is HydratedFoundPlanet {
        if (!action.playerId) return false
        return this.validActionsForPlayer(action.playerId, context).some(
            (type) => type === action.type
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return context.gameState.pendingFounding?.playerId === playerId
            ? [ActionType.FoundPlanet]
            : []
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const pending = context.gameState.pendingFounding
        if (pending) context.gameState.activePlayerIds = [pending.playerId]
    }

    onAction(
        action: HydratedFoundPlanet,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        if (!isFoundPlanet(action)) throw Error('Invalid action type')
        return endPlacement(context.gameState, context)
    }
}
