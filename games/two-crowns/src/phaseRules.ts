import { TwoCrownsMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules, type TrainPurchaseState } from '@tabletop/18xx'
import type { TwoCrownsState } from './state.js'
import { TwoCrownsPhases } from './trains.js'

type TitleState = TrainPurchaseState &
    Pick<TwoCrownsState, 'fourPlusTrainIdsWithOperatingOpportunity' | 'quarantinedTrainId'>

export const TwoCrownsPhaseRules: PhaseRules = {
    rustTiming(state: TitleState, train) {
        const timing = TwoCrownsPhases.rustTiming(state.phaseId, train.definitionId)
        // The train with the Rijeka Lazaretto's quarantine marker runs one more OR (lazaretto.ts).
        if (timing && train.status === 'owned' && train.id === state.quarantinedTrainId)
            return 'after-operation'
        if (
            timing &&
            train.definitionId === '4+' &&
            train.status === 'owned' &&
            !state.fourPlusTrainIdsWithOperatingOpportunity?.includes(train.id)
        )
            return 'after-operation'
        return timing
    },
    discardOrder: (state, companyId) =>
        marketDiscardOrder(TwoCrownsMarket, state, companyId, ['LUKA']),
    discardDestination: 'removed'
}
