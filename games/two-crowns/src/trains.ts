import { TwoCrownsMap } from './map.js'
import { TwoCrownsTileSet } from './tiles.js'
import {
    PhaseTable,
    TrainDepot,
    requiresStationRoute,
    type TrainDefinition,
    type TrainRules
} from '@tabletop/18xx'
import { TwoCrownsPhaseData, TwoCrownsTrainData } from './generated/data.js'

function distance(id: string): TrainDefinition['distance'] {
    if (id === 'D') return { measure: 'revenue-centers', maximum: 'unlimited' }
    const reach = Number.parseInt(id, 10)
    if (id.endsWith('H')) return { measure: 'hex-edges', maximum: reach }
    if (id.endsWith('+')) return { measure: 'cities-and-offboards', maximum: reach }
    return { measure: 'revenue-centers', maximum: reach }
}

export const TwoCrownsTrainDepot = new TrainDepot({
    id: 'two-crowns',
    trains: TwoCrownsTrainData.map((train) => ({
        id: train.id,
        name: train.id,
        price: train.price,
        distance: distance(train.id),
        ...('rustsOn' in train ? { rustsOn: train.rustsOn } : {})
    })),
    // Diesels are unlimited (1874design.md, Trains and phases); the printed count is not a cap.
    supply: TwoCrownsTrainData.map((train) => ({
        definitionId: train.id,
        count: train.id === 'D' ? ('unlimited' as const) : train.count
    }))
})

const TileColorOrder = ['yellow', 'green', 'brown', 'gray']
export const TwoCrownsPhases = new PhaseTable(
    TwoCrownsPhaseData.map((phase, index) => ({
        id: phase.id,
        startedBy: index === 0 ? [] : [phase.id],
        tileColors: TileColorOrder.slice(0, TileColorOrder.indexOf(phase.tileColor) + 1),
        operatingRounds: phase.operatingRounds,
        trainLimit: phase.trainLimit
    })),
    TwoCrownsTrainDepot
)
const hasRoute = requiresStationRoute(TwoCrownsMap, TwoCrownsTileSet)
type TradeInState = { tradeIns?: string[]; operatingSet?: { number: number; roundNumber: number } }
const tradeInState = (state: object) => state as TradeInState
function tradeInKey(state: object, companyId: string): string {
    const set = tradeInState(state).operatingSet
    return `${set?.number ?? 0}.${set?.roundNumber ?? 0}:${companyId}`
}
const TrainOrder = TwoCrownsTrainData.map((train) => train.id as string)
/**
 * 1894's train upgrade (1874design.md, Trade-ins): once per OR, a supply purchase may hand in a
 * train of the rank just below, never a 4+ or a 7, for half its face; the train leaves the game.
 * So a 7 and a Diesel take no trade-in (a 7 for a Diesel was allowed until design 0.10.0).
 */
const NeverTradedIn = ['4+', '7']
export function tradeInPrice(definitionId: string, tradedDefinitionId: string): number | undefined {
    const rank = TrainOrder.indexOf(definitionId)
    if (
        rank < 1 ||
        TrainOrder[rank - 1] !== tradedDefinitionId ||
        NeverTradedIn.includes(tradedDefinitionId)
    )
        return undefined
    const price = TwoCrownsTrainDepot.trainDefinition(definitionId).price
    return price - TwoCrownsTrainDepot.trainDefinition(tradedDefinitionId).price / 2
}
export const TwoCrownsTrainRules: TrainRules = {
    depot: TwoCrownsTrainDepot,
    exchangePrice: (state, companyId, definitionId, train) =>
        tradeInState(state).tradeIns?.includes(tradeInKey(state, companyId))
            ? undefined
            : tradeInPrice(definitionId, train.definitionId),
    exchangedTrainDestination: 'removed',
    afterExchange(state, details) {
        const key = tradeInKey(state, details.companyId)
        const round = key.split(':')[0]
        const title = tradeInState(state)
        title.tradeIns = [
            ...(title.tradeIns ?? []).filter((item) => item.startsWith(`${round}:`)),
            key
        ]
    },
    requiresTrain: (state, companyId) => companyId !== 'LUKA' && hasRoute(state, companyId),
    availableDefinitions(state) {
        const next = TwoCrownsTrainDepot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        TwoCrownsPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => TwoCrownsPhases.phase(state.phaseId).trainLimit,
    purchaseLimit: (_state, companyId) => (companyId === 'LUKA' ? 1 : 'unlimited')
}
