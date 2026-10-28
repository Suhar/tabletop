import { TwoCrownsCharters } from './charters.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { TwoCrownsPhases } from './trains.js'
import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    getCompany,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const TwoCrownsStockRoundRules: StockRoundRules = {
    passing: 'pass-order',
    nextPlayerOrder: (state) => [...state.stockRound.passedPlayerIds],
    soldOut: (state, companyId) =>
        allSharesHeld(
            state,
            companyId,
            (certificate) =>
                certificate.owner.kind === 'player' ||
                certificate.poolId === 'reserved' ||
                (certificate.owner.kind === 'company' && certificate.owner.companyId === 'P12')
        )
}
export const TwoCrownsOperatingRules: OperatingRules = {
    charters: TwoCrownsCharters,
    roundCount: (state) => TwoCrownsPhases.phase(state.phaseId).operatingRounds,
    companyOrder(state) {
        const companies = floatedCompaniesInMarketOrder(TwoCrownsMarket, state)
        if (!getCompany(state, 'LUKA').closed) companies.push('LUKA')
        return companies
    }
}
