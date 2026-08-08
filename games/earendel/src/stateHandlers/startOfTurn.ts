import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'

type StartOfTurnAction = HydratedAction

export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction, HydratedEarendelGameState> {

    isValidAction(action: HydratedAction, context: MachineContext<HydratedEarendelGameState>): action is StartOfTurnAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedEarendelGameState>): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {

    }

    onAction(action: StartOfTurnAction, context: MachineContext<HydratedEarendelGameState>): MachineState {
        switch (true) {
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
