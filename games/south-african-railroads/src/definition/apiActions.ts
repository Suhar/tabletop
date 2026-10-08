import { ActionType } from './actions.js'
import { BuildConnection } from '../actions/buildConnection.js'
import { BuildTrack } from '../actions/buildTrack.js'
import { ChooseAction } from '../actions/chooseAction.js'
import { DeclineOffer } from '../actions/declineOffer.js'
import { DelegateBuild } from '../actions/delegateBuild.js'
import { Develop } from '../actions/develop.js'
import { FinishDevelopment } from '../actions/finishDevelopment.js'
import { OfferShare } from '../actions/offerShare.js'
import { PassBid } from '../actions/passBid.js'
import { PayDividends } from '../actions/payDividends.js'
import { PlaceBid } from '../actions/placeBid.js'

export const SarApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.ChooseAction]: ChooseAction,
    [ActionType.BuildTrack]: BuildTrack,
    [ActionType.BuildConnection]: BuildConnection,
    [ActionType.DelegateBuild]: DelegateBuild,
    [ActionType.Develop]: Develop,
    [ActionType.FinishDevelopment]: FinishDevelopment,
    [ActionType.OfferShare]: OfferShare,
    [ActionType.DeclineOffer]: DeclineOffer,
    [ActionType.PayDividends]: PayDividends
}
