import { ActionType } from './actions.js'
import { PlaceBid } from '../actions/placeBid.js'
import { BuyTile } from '../actions/buyTile.js'
import { PassTile } from '../actions/passTile.js'
import { PassBid } from '../actions/passBid.js'
import { PlaceTile } from '../actions/placeTile.js'
import { ChooseRoute } from '../actions/chooseRoute.js'

export const ConduitApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.BuyTile]: BuyTile,
    [ActionType.PassTile]: PassTile,
    [ActionType.PassBid]: PassBid,
    [ActionType.PlaceTile]: PlaceTile,
    [ActionType.ChooseRoute]: ChooseRoute
}
