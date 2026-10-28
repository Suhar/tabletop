import * as Type from 'typebox'
import { TwoCrownsMarket } from './stockMarket.js'
import {
    closePrivate,
    controllingOwner,
    marketDiscardOrder,
    privateOwner,
    sameOwner,
    type PhaseRules,
    type TrainPurchaseState
} from '@tabletop/18xx'
import type { TwoCrownsState } from './state.js'
import { TwoCrownsPhases, TwoCrownsTrainDepot } from './trains.js'

type TitleState = TrainPurchaseState &
    Pick<TwoCrownsState, 'fourPlusTrainIdsWithOperatingOpportunity' | 'quarantinedTrainId'>

const PhaseChanges = Type.Object(
    { quarantinedTrainId: Type.Optional(Type.String()) },
    { additionalProperties: false }
)

/**
 * The Rijeka Lazaretto (1874design.md, Quarantine): the first rust that would remove a train of a
 * company its owner presides quarantines that company's most valuable rusting train instead. The
 * owner's choice of rust and train is simplified to the first rust and the dearest train.
 */
function quarantine(state: TitleState): string | undefined {
    const lazaretto = state.companies.find((company) => company.id === 'P5')
    const owner = lazaretto && !lazaretto.closed ? privateOwner(state, 'P5') : undefined
    if (owner?.kind !== 'player') return undefined
    const train = state.trainInventory.trains
        .filter(
            (train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.definitionId !== '4+' &&
                TwoCrownsPhases.rustTiming(state.phaseId, train.definitionId) === 'immediate' &&
                sameOwner(controllingOwner(state, train.owner.companyId) ?? { kind: 'bank' }, owner)
        )
        .sort(
            (a, b) =>
                TwoCrownsTrainDepot.trainDefinition(b.definitionId).price -
                TwoCrownsTrainDepot.trainDefinition(a.definitionId).price
        )[0]
    if (!train) return undefined
    state.quarantinedTrainId = train.id
    closePrivate(state, 'P5')
    return train.id
}

export const TwoCrownsPhaseRules: PhaseRules = {
    rustTiming(state: TitleState, train) {
        const timing = TwoCrownsPhases.rustTiming(state.phaseId, train.definitionId)
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
    discardDestination: 'removed',
    changes: {
        schema: PhaseChanges,
        apply(state) {
            const quarantinedTrainId = quarantine(state as unknown as TitleState)
            return quarantinedTrainId ? { quarantinedTrainId } : {}
        }
    }
}
