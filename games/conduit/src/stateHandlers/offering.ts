import type { HydratedAction, MachineContext, MachineStateHandler } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuyTile, isBuyTile } from '../actions/buyTile.js'
import { HydratedPassTile, isPassTile } from '../actions/passTile.js'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { endTurn, nextResolutionState, offeredPlayerId, startTurn } from './flow.js'

type OfferAction = HydratedBuyTile | HydratedPassTile

// The owner of the bottom cube on the track buys the tile or passes it up the track.
export class OfferingStateHandler implements MachineStateHandler<
    OfferAction,
    HydratedConduitGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedConduitGameState>
    ): action is OfferAction {
        const state = context.gameState
        if (isBuyTile(action)) {
            return HydratedBuyTile.canBuyTile(state, action.playerId)
        }
        if (isPassTile(action)) {
            return HydratedPassTile.canPassTile(state, action.playerId)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedConduitGameState>
    ): ActionType[] {
        const state = context.gameState
        return [
            ...(HydratedBuyTile.canBuyTile(state, playerId) ? [ActionType.BuyTile] : []),
            ...(HydratedPassTile.canPassTile(state, playerId) ? [ActionType.PassTile] : [])
        ]
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        const state = context.gameState
        startTurn(state, offeredPlayerId(state))
    }

    onAction(action: OfferAction, context: MachineContext<HydratedConduitGameState>): MachineState {
        endTurn(context.gameState)
        return isBuyTile(action) ? MachineState.Placing : nextResolutionState(context)
    }
}
