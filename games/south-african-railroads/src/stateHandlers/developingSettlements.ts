import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import { HydratedFinishDevelopment, isFinishDevelopment } from '../actions/finishDevelopment.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { finishTurnAction } from './flow.js'

const DEVELOPMENTS_PER_ACTION = 2

type DevelopingAction = HydratedDevelop | HydratedFinishDevelopment

export class DevelopingSettlementsStateHandler implements MachineStateHandler<
    DevelopingAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is DevelopingAction {
        return isDevelop(action) || isFinishDevelopment(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.turnPlayerId() !== playerId) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.Develop, HydratedDevelop.canDevelop(state, playerId)],
            [ActionType.FinishDevelopment, HydratedFinishDevelopment.canFinish(state)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        action: DevelopingAction,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        const state = context.gameState
        const done =
            isFinishDevelopment(action) ||
            state.developmentsThisTurn >= DEVELOPMENTS_PER_ACTION ||
            state.affordableDevelopments(action.playerId).length === 0
        return done ? finishTurnAction(state) : MachineState.DevelopingSettlements
    }
}
