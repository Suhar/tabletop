import { TwoCrownsCharters } from './charters.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import {
    dividendEntitlements,
    companyShareCount,
    getCompany,
    trainsOwnedBy,
    type DistributionState,
    type EarningsRules
} from '@tabletop/18xx'
import { lukaShares } from './luka.js'
import type { TwoCrownsState } from './state.js'
export const TwoCrownsEarningsRules: EarningsRules = {
    choices: (_state, companyId) =>
        companyId === 'LUKA' ? ['pay', 'half-pay', 'withhold'] : ['pay', 'withhold'],
    shareCount(state, companyId) {
        if (companyId === 'LUKA') return lukaShares(state).length
        const count = companyShareCount(state, TwoCrownsCharters, companyId)
        assertExists(count, 'Dividends require a share count')
        return count
    },
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === 'reserved'
                ? undefined
                : certificate.owner.kind === 'bank'
                  ? { kind: 'company', companyId }
                  : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) =>
        choice === 'withhold' ? revenue : choice === 'half-pay' ? Math.ceil(revenue / 2) : 0,
    roundDividend: (_state, companyId, amount) =>
        companyId === 'LUKA' ? Math.ceil(amount) : amount,
    marketEffect(state, companyId, distribution) {
        if (companyId === 'LUKA' || !getCompany(state, companyId).floated)
            return { bonusPerShare: 0 }
        return {
            move: TwoCrownsMarket.dividendMove(
                state.stockMarket,
                companyId,
                distribution.baseDividendPerShare > 0
            ),
            bonusPerShare:
                distribution.baseDividendPerShare > 0 &&
                TwoCrownsMarket.companySpace(state.stockMarket, companyId).price === 400
                    ? 40
                    : 0
        }
    },
    afterDistribution(
        state: DistributionState & Pick<TwoCrownsState, 'fourPlusTrainIdsWithOperatingOpportunity'>,
        companyId
    ) {
        const trains = trainsOwnedBy(state, { kind: 'company', companyId }).filter(
            (train) => train.definitionId === '4+'
        )
        if (!trains.length) return
        state.fourPlusTrainIdsWithOperatingOpportunity = [
            ...new Set([
                ...(state.fourPlusTrainIdsWithOperatingOpportunity ?? []),
                ...trains.map((train) => train.id)
            ])
        ]
    }
}
