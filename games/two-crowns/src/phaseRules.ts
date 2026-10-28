import { TwoCrownsMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules, type TrainPurchaseState } from '@tabletop/18xx'
import type { TwoCrownsState } from './state.js'
import { TwoCrownsPhases } from './trains.js'
export const TwoCrownsPhaseRules: PhaseRules = {
    rustTiming(
        state: TrainPurchaseState &
            Pick<TwoCrownsState, 'fourPlusTrainIdsWithOperatingOpportunity'>,
        train
    ) {
        const timing = TwoCrownsPhases.rustTiming(state.phaseId, train.definitionId)
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
