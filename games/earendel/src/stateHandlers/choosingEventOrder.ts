import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedChooseEventOrder, isChooseEventOrder } from '../actions/chooseEventOrder.js'

type ChoosingEventOrderAction = HydratedChooseEventOrder

// The discoverer of an elevated event orders the other players (rules.md, Elevated technologies).
export class ChoosingEventOrderStateHandler implements MachineStateHandler<
    ChoosingEventOrderAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is ChoosingEventOrderAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.ChooseEventOrder].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const pending = context.gameState.pendingEvent
        if (!pending) return
        context.gameState.activePlayerIds = [pending.discovererId]
    }

    onAction(
        action: ChoosingEventOrderAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        if (isChooseEventOrder(action)) return MachineState.ResolvingEvent
        throw Error('Invalid action type')
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const pending = context.gameState.pendingEvent
        if (!pending || pending.order || pending.discovererId !== playerId) return false
        return actionType === ActionType.ChooseEventOrder
    }
}
