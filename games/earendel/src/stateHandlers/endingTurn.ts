import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { isUseUpdatedLogistics } from '../actions/useUpdatedLogistics.js'
import { isUseTacticalFeint } from '../actions/useTacticalFeint.js'
import { isUseTradeRouteWormhole } from '../actions/useTradeRouteWormhole.js'
import { isUseImmediateDownload } from '../actions/useImmediateDownload.js'
import { usableTechnologies } from '../util/usableTechnology.js'
import { finishTurn } from '../util/turn.js'
import { stateAfterTechnologyUse, type TechnologyUse } from './technologyUse.js'

type EndingTurnAction = HydratedEndTurn | TechnologyUse

// The player's ships are placed but a technology could still act: use it, or end the turn.
export class EndingTurnStateHandler implements MachineStateHandler<
    EndingTurnAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is EndingTurnAction {
        if (!action.playerId) return false
        return this.validActionsForPlayer(action.playerId, context).some(
            (actionType) => actionType === action.type
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) return []
        return [...usableTechnologies(gameState, playerId), ActionType.EndTurn]
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const current = gameState.turnManager.currentTurn()
        if (current) gameState.activePlayerIds = [current.playerId]
    }

    onAction(
        action: EndingTurnAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState
        switch (true) {
            case isEndTurn(action): {
                return finishTurn(gameState, context)
            }
            case isUseUpdatedLogistics(action):
            case isUseTacticalFeint(action):
            case isUseTradeRouteWormhole(action):
            case isUseImmediateDownload(action): {
                return stateAfterTechnologyUse(action, gameState, context)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
