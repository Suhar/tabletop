import { TwoCrownsCharters } from './charters.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { twoCrownsPlayerSetup } from './players.js'
import { TwoCrownsStockRoundRules } from './roundRules.js'
import { assertExists } from '@tabletop/common'
import { ShareHoldingCharterIds } from './holdings.js'
import {
    companyShareCount,
    getCompany,
    marketSaleTerms,
    playersAfterPresident,
    privateOwner,
    sameOwner,
    treasuryPoolId,
    type Owner,
    type StockState,
    type StockRules,
    standardCertificateWeight
} from '@tabletop/18xx'

export const TwoCrownsStockRules: StockRules = {
    market: TwoCrownsMarket,
    charters: TwoCrownsCharters,
    round: TwoCrownsStockRoundRules,
    buyers(state, playerId) {
        const player: Owner = { kind: 'player', playerId }
        const buyers: Owner[] = [player]
        // The Štedionica and the Ungaro-Croata Charter each buy once per stock round.
        for (const charterId of ShareHoldingCharterIds) {
            const charter = state.companies.find((company) => company.id === charterId)
            const owner = charter && !charter.closed ? privateOwner(state, charterId) : undefined
            if (
                owner &&
                sameOwner(owner, player) &&
                !state.stockRound.companyPurchases.includes(charterId)
            )
                buyers.push({ kind: 'company', companyId: charterId })
        }
        return buyers
    },
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started or is closed.'
        if (certificate.president) return 'Starting a company is not available in this example.'
        if (certificate.shares !== 1) return 'Only one ordinary share can be bought on this turn.'
        const market = certificate.owner.kind === 'bank' && certificate.poolId === 'market'
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id &&
            certificate.poolId === treasuryPoolId(company.id)
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        return {
            price: TwoCrownsMarket.companySpace(state.stockMarket, company.id).price,
            recipient: certificate.owner,
            payers: twoCrownsPurchasePayers(state, buyer)
        }
    },
    saleTerms(state, companyId) {
        const company = getCompany(state, companyId)
        const shareCount = companyShareCount(state, TwoCrownsCharters, companyId)
        if (companyId === 'LUKA' || !shareCount || !company.president)
            return 'This company has no saleable shares.'
        if (!company.operated) return 'Shares cannot be sold until the company has operated.'
        return marketSaleTerms(TwoCrownsMarket, state, companyId, {
            destinationPoolId: 'market',
            marketLimit: 80,
            maximumShares: shareCount * 0.3,
            movement: 1
        })
    },
    certificateLimit: (state) => twoCrownsPlayerSetup(state.players.length).certificateLimit,
    certificateWeight: (_state, certificate) => standardCertificateWeight(certificate),
    ownershipLimit: () => 60,
    presidencyCandidates(state, companyId) {
        return [
            ...playersAfterPresident(state, companyId, state.turnManager.turnOrder),
            ...ShareHoldingCharterIds.map((companyId) => ({ kind: 'company' as const, companyId }))
        ]
    },
    turnOrder: 'sell-buy',
    repeatSales: 'extend-block'
}

export function twoCrownsPurchasePayers(state: StockState, buyer: Owner): Owner[] {
    if (buyer.kind !== 'company') return [buyer]
    const owner = privateOwner(state, buyer.companyId)
    assertExists(owner, 'Štedionica requires an owner')
    return [buyer, owner]
}
