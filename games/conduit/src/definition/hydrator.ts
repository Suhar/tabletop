import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedConduitGameState, type ConduitProjectedState } from '../model/gameState.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedBuyTile, isBuyTile } from '../actions/buyTile.js'
import { HydratedPassTile, isPassTile } from '../actions/passTile.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPlaceTile, isPlaceTile } from '../actions/placeTile.js'
import { HydratedChooseRoute, isChooseRoute } from '../actions/chooseRoute.js'
import { HydratedFillMarket, isFillMarket } from '../actions/fillMarket.js'
import { HydratedPayRevenue, isPayRevenue } from '../actions/payRevenue.js'
import { HydratedLoseInfrastructure, isLoseInfrastructure } from '../actions/loseInfrastructure.js'

export class ConduitHydrator implements GameHydrator<
    ConduitProjectedState,
    HydratedConduitGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isBuyTile(data):
                return new HydratedBuyTile(data)
            case isPassTile(data):
                return new HydratedPassTile(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isPlaceTile(data):
                return new HydratedPlaceTile(data)
            case isChooseRoute(data):
                return new HydratedChooseRoute(data)
            case isFillMarket(data):
                return new HydratedFillMarket(data)
            case isPayRevenue(data):
                return new HydratedPayRevenue(data)
            case isLoseInfrastructure(data):
                return new HydratedLoseInfrastructure(data)
            default:
                throw new Error(`Unknown action type: ${data.type}`)
        }
    }

    hydrateState(state: ConduitProjectedState): HydratedConduitGameState {
        return new HydratedConduitGameState(state)
    }
}
