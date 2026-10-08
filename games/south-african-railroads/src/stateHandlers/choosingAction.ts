import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { RailroadId } from '../components/railroads.js'
import { HydratedChooseAction, isChooseAction } from '../actions/chooseAction.js'
import { ActionBox } from '../model/actionBoxes.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { finishTurnAction } from './flow.js'

const NEXT_STATE: Record<ActionBox, MachineState> = {
    [ActionBox.ConstructTrack]: MachineState.ConstructingTrack,
    [ActionBox.OfferStock]: MachineState.OfferingStock,
    [ActionBox.DevelopSettlements]: MachineState.DevelopingSettlements,
    [ActionBox.PayDividends]: MachineState.PayingDividends
}

export class ChoosingActionStateHandler implements MachineStateHandler<
    HydratedChooseAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is HydratedChooseAction {
        return isChooseAction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        return HydratedChooseAction.canChoose(context.gameState, playerId)
            ? [ActionType.ChooseAction]
            : []
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const state = context.gameState
        if (!state.turnManager.currentTurn()) {
            if (state.turnManager.series.length === 0) {
                // The CMRC's opening shareholder takes the first turn.
                state.turnManager.startTurn(
                    state.railroad(RailroadId.CMRC).owners[0],
                    state.actionCount
                )
            } else {
                state.turnManager.startNextTurn(state.actionCount)
            }
        }
        state.activePlayerIds = [state.turnPlayerId()]
    }

    onAction(
        action: HydratedChooseAction,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        return action.metadata?.nothingToDo
            ? finishTurnAction(context.gameState)
            : NEXT_STATE[action.box]
    }
}
