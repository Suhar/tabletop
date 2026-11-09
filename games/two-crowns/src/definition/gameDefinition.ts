import { TwoCrownsNames } from '../names.js'
import { createEighteenXXRuntime, defineAction, type EighteenXXTitleRules } from '@tabletop/18xx'
import type { GameDefinition } from '@tabletop/common'
import { TwoCrownsCompanyRules } from '../companyRules.js'
import { TwoCrownsEarningsRules } from '../earningsRules.js'
import { TwoCrownsEndingRules } from '../endingRules.js'
import {
    TwoCrownsAuctionRules,
    createTwoCrownsOpening,
    twoCrownsStartingCash
} from '../openingAuction.js'
import { TwoCrownsPhaseRules } from '../phaseRules.js'
import { TwoCrownsPrivatePowerRules } from '../privatePowerRules.js'
import { TwoCrownsPrivateRules } from '../privateRules.js'
import { TwoCrownsOperatingRules } from '../roundRules.js'
import { TwoCrownsRouteRules } from '../routeRules.js'
import { HydratedSplitCompany, SplitCompany, isSplitCompany } from '../splitCompany.js'
import { ConvertCharter, HydratedConvertCharter, isConvertCharter } from '../charterConversion.js'
import {
    HydratedQuarantineTrain,
    QuarantineTrain,
    isQuarantineTrain,
    offersQuarantine
} from '../lazaretto.js'
import { TwoCrownsState, TwoCrownsStateDefinition, type HydratedTwoCrownsState } from '../state.js'
import { TwoCrownsStationRules } from '../stationRules.js'
import { TwoCrownsStockRoundHandler } from '../stockRoundHandler.js'
import { TwoCrownsStockRules } from '../stockRules.js'
import { TwoCrownsTrackRules } from '../trackRules.js'
import { TwoCrownsTrainFundingRules } from '../trainFundingRules.js'
import { TwoCrownsPhases, TwoCrownsTrainRules } from '../trains.js'
import { TwoCrownsTransferRules } from '../transferRules.js'
import { TwoCrownsInfo } from './info.js'

export const TwoCrownsTitleRules: EighteenXXTitleRules<
    typeof TwoCrownsState,
    HydratedTwoCrownsState
> = {
    state: TwoCrownsStateDefinition,
    endingRules: TwoCrownsEndingRules,
    names: TwoCrownsNames,
    decisionHandlers: {
        StockRound: (family) => new TwoCrownsStockRoundHandler(family),
        // The Rijeka Lazaretto's marker, at any step of the operating company's turn.
        LayingTrack: offersQuarantine,
        PlacingStation: offersQuarantine,
        BuyingTrains: offersQuarantine
    },
    titleActions: [
        defineAction(SplitCompany, isSplitCompany, (action) => new HydratedSplitCompany(action)),
        defineAction(
            ConvertCharter,
            isConvertCharter,
            (action) => new HydratedConvertCharter(action)
        ),
        defineAction(
            QuarantineTrain,
            isQuarantineTrain,
            (action) => new HydratedQuarantineTrain(action)
        )
    ],
    offerAuctionRules: TwoCrownsAuctionRules,
    trainFundingRules: TwoCrownsTrainFundingRules,
    transferRules: TwoCrownsTransferRules,
    privatePowerRules: TwoCrownsPrivatePowerRules,
    createOpening: createTwoCrownsOpening,
    startingCash: twoCrownsStartingCash,
    currencySymbol: '$',
    stockRules: TwoCrownsStockRules,
    companyRules: TwoCrownsCompanyRules,
    operatingRules: TwoCrownsOperatingRules,
    trackRules: TwoCrownsTrackRules,
    stationRules: TwoCrownsStationRules,
    earningsRules: TwoCrownsEarningsRules,
    routeRules: TwoCrownsRouteRules,
    privateRules: TwoCrownsPrivateRules,
    phases: TwoCrownsPhases,
    phaseRules: TwoCrownsPhaseRules,
    trainRules: TwoCrownsTrainRules
}

export const Definition: GameDefinition<TwoCrownsState, HydratedTwoCrownsState> = {
    info: TwoCrownsInfo,
    runtime: createEighteenXXRuntime(TwoCrownsTitleRules)
}
