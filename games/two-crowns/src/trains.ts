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
export const TwoCrownsTrainRules: TrainRules = {
    depot: TwoCrownsTrainDepot,
    exchangePrice: () => undefined,
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
