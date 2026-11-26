import type { HydratedAction, MachineContext, MachineStateHandler } from '@tabletop/common'
import { assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseRoute, isChooseRoute } from '../actions/chooseRoute.js'
import { PayRevenue } from '../actions/payRevenue.js'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { endTurn, startTurn } from './flow.js'

export class ChoosingRoutesStateHandler implements MachineStateHandler<
    HydratedChooseRoute,
    HydratedConduitGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedConduitGameState>
    ): action is HydratedChooseRoute {
        return (
            isChooseRoute(action) && HydratedChooseRoute.canChooseRoute(context.gameState, action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedConduitGameState>
    ): ActionType[] {
        return context.gameState.pendingRouteChoice()?.playerId === playerId
            ? [ActionType.ChooseRoute]
            : []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        const choice = context.gameState.pendingRouteChoice()
        assertExists(choice, 'A route is waiting to be chosen')
        startTurn(context.gameState, choice.playerId)
    }

    onAction(
        _action: HydratedChooseRoute,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        endTurn(context.gameState)
        if (context.gameState.pendingRouteChoice()) {
            return MachineState.ChoosingRoutes
        }
        context.addSystemAction(PayRevenue)
        return MachineState.PayingRevenue
    }
}
