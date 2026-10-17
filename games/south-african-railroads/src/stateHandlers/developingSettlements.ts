import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedDevelop, isDevelop } from '../actions/develop.js'
import {
    FinishDevelopment,
    HydratedFinishDevelopment,
    isFinishDevelopment
} from '../actions/finishDevelopment.js'
import { HydratedLeaveTown, isLeaveTown } from '../actions/leaveTown.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { finishTurnAction } from './flow.js'

const DEVELOPMENTS_PER_ACTION = 2

type DevelopingAction = HydratedDevelop | HydratedFinishDevelopment | HydratedLeaveTown

export class DevelopingSettlementsStateHandler implements MachineStateHandler<
    DevelopingAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is DevelopingAction {
        return isDevelop(action) || isFinishDevelopment(action) || isLeaveTown(action)
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
            [ActionType.FinishDevelopment, HydratedFinishDevelopment.canFinish(state)],
            [ActionType.LeaveTown, HydratedLeaveTown.canLeaveTown(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const state = context.gameState
        const playerId = state.turnPlayerId()
        state.activePlayerIds = [playerId]
        // A second development nobody can make is declined, so Automatic Metro Development runs.
        if (state.mayFinishDeveloping() && state.affordableDevelopments(playerId).length === 0) {
            context.addSystemAction(FinishDevelopment, { playerId })
        }
    }

    onAction(
        action: DevelopingAction,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        const state = context.gameState
        const done = !isDevelop(action) || state.developmentsThisTurn >= DEVELOPMENTS_PER_ACTION
        return done ? finishTurnAction(state) : MachineState.DevelopingSettlements
    }
}
