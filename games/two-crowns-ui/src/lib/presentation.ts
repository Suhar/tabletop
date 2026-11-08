import { isTreasuryPoolId } from '@tabletop/18xx'
import { moneyFormat, type TitlePresentation } from '@tabletop/18xx-ui'
import { TwoCrownsCompanies, TwoCrownsNames } from '@tabletop/two-crowns'
import { TwoCrownsCompanyNames } from './companyPresentation.js'
import { TwoCrownsPhaseChart } from './phaseChart.js'
import { TwoCrownsMarketZones } from './marketPresentation.js'
import { TwoCrownsTrainColors } from './trainPresentation.js'

export const TwoCrownsPresentation: TitlePresentation = {
    money: moneyFormat('$'),
    phaseChart: TwoCrownsPhaseChart,
    trainColors: TwoCrownsTrainColors,
    phaseColors: TwoCrownsTrainColors,
    marketPoolId: 'market',
    marketZones: TwoCrownsMarketZones,
    hideMarketLegend: true,
    exchangePoolId: 'reserved',
    companyNames: TwoCrownsCompanyNames,
    companyPricePresentation: { showPar: false, label: 'Value' },
    numberedShareNames: {
        LUKA: Object.fromEntries(
            TwoCrownsCompanies.map((company) => [company.number, company.name])
        )
    },
    includedCompanyIds: ['LUKA'],
    mapFocusExcludedCompanyIds: ['LUKA'],
    portfolioCompanyIds: ['P12', 'P14'],
    includedPortfolioCompanyIds: ['P12', 'P14'],
    poolName: (poolId) =>
        poolId === 'reserved'
            ? 'Exchange'
            : isTreasuryPoolId(poolId)
              ? 'Treasury'
              : TwoCrownsNames.pool(poolId),
    privatePurchaseLabel: 'Buy Wiener Neustadt',
    privatePurchaseEmpty: 'You don’t own Wiener Neustadt'
}
