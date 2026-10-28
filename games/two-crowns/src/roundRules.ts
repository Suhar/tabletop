import { TwoCrownsCharters } from './charters.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { TwoCrownsPhases } from './trains.js'
import { isHeldShare } from './holdings.js'
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
    soldOut: (state, companyId) => allSharesHeld(state, companyId, isHeldShare)
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
