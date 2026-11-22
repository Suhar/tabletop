import { isTreasuryPoolId, type Train } from '@tabletop/18xx'
import { moneyFormat, type TitlePresentation, type TrainTokens } from '@tabletop/18xx-ui'
import { TwoCrownsNames, type TwoCrownsState } from '@tabletop/two-crowns'
import { LukaHomes } from './lukaHomes.js'
import { TwoCrownsCompanyNames } from './companyPresentation.js'
import { NoTradeInsPhaseChart, TwoCrownsPhaseChart } from './phaseChart.js'
import { TwoCrownsMarketZones } from './marketPresentation.js'
import { TwoCrownsTrainColors } from './trainPresentation.js'

// Every train has an entry once one is marked, so that a row of badges lines up at the top.
function quarantineTokens(state: TwoCrownsState, train: Train): TrainTokens | undefined {
    const marked = state.quarantinedTrainId
    if (!marked) return undefined
    return marked === train.id && train.status === 'owned'
        ? {
              count: 0,
              lapsing: false,
              label: 'Lazaretto',
              description: 'Lazaretto marker: runs one more OR when it would rust'
          }
        : { count: 0, lapsing: false, description: '' }
}

export const TwoCrownsPresentation: TitlePresentation<TwoCrownsState> = {
    money: moneyFormat('$'),
    phaseChart: TwoCrownsPhaseChart,
    phaseChartFor: (state) =>
        state.variants?.noTradeIns ? NoTradeInsPhaseChart : TwoCrownsPhaseChart,
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
            LukaHomes.map(({ number, name, place }) => [
                number,
                name === place ? name : `${name} (${place})`
            ])
        )
    },
    trainTokens: quarantineTokens,
    startNotes: (_state, companyId) => {
        const home = LukaHomes.find((entry) => entry.companyId === companyId)
        return home ? [`Home: ${home.place}`] : []
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
              : TwoCrownsNames.pool(poolId)
}
