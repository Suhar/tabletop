import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { EventPick, HydratedEventPick, isEventPick } from '../actions/eventPick.js'
import { hasEventPick } from '../util/events.js'
import { endPlacement } from '../util/turn.js'

type ResolvingEventAction = HydratedEventPick

// Each player in the discoverer's order takes their pick; one with nothing to pick is passed
// over (rules.md, Elevated technologies). The discoverer's turn resumes afterwards.
export class ResolvingEventStateHandler implements MachineStateHandler<
    ResolvingEventAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is ResolvingEventAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.EventPick].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const pending = gameState.pendingEvent
        if (!pending?.order) return
        const playerId = pending.order[0]
        if (!playerId) return
        gameState.activePlayerIds = [playerId]

        if (!hasEventPick(gameState, pending, playerId)) {
            context.addSystemAction(EventPick, { playerId })
        }
    }

    onAction(
        action: ResolvingEventAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        if (!isEventPick(action)) throw Error('Invalid action type')
        const gameState = context.gameState
        const pending = gameState.pendingEvent
        if (pending?.order && pending.order.length > 0) {
            return MachineState.ResolvingEvent
        }
        gameState.pendingEvent = undefined
        return endPlacement(gameState, context)
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const pending = context.gameState.pendingEvent
        if (!pending?.order || pending.order[0] !== playerId) return false
        return actionType === ActionType.EventPick
    }
}
