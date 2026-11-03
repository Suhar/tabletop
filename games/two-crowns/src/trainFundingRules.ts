import { TwoCrownsMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import { TwoCrownsOperatingRules } from './roundRules.js'
import {
    marketSaleTerms,
    reorderPendingOperatingCompanies,
    getCompany,
    privateOwner,
    type TrainFundingRules
} from '@tabletop/18xx'
import { TwoCrownsStockRules } from './stockRules.js'
export const TwoCrownsTrainFundingRules: TrainFundingRules = {
    sellInBlocks: true,
    afterShareSale(state) {
        reorderPendingOperatingCompanies(state, TwoCrownsOperatingRules.companyOrder(state))
    },
    includeMarketTrains: false,
    contributors(state, companyId) {
        const president = getCompany(state, companyId).president
        assertExists(president, 'A railway requires its president')
        if (president.kind === 'player') return [president]
        const owner = privateOwner(state, president.companyId)
        assertExists(owner, 'Austrian Bank requires its owner')
        return [president, owner]
    },
    issuanceTerms(state, companyId, shares) {
        return marketSaleTerms(TwoCrownsMarket, state, companyId, {
            destinationPoolId: 'market',
            marketLimit: 100,
            maximumShares: shares,
            movement: 1
        })
    },
    saleTerms: (state, companyId, shares, seller) =>
        TwoCrownsStockRules.saleTerms(state, companyId, shares, seller),
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    requiredSaleShares: () => 0
}
