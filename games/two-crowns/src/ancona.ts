import {
    RailwayMapState,
    closePrivate,
    routeRevenue,
    type PurchaseOffer,
    type RouteRevenuePolicy,
    type TrainRunningState
} from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsPhases } from './trains.js'
import type { TwoCrownsState } from './state.js'

// 1874design.md, Ancona Steamship Line (P17).
export const AnconaId = 'B16'
export const AnconaLineId = 'P17'

type AnconaState = Pick<TwoCrownsState, 'anconaCompanyId'>

// The company that bought the line gets its Ancona station and bonus, and the line closes.
export function afterAnconaPurchase(state: object, offer: PurchaseOffer): void {
    if (offer.asset.kind !== 'private' || offer.asset.privateCompanyId !== AnconaLineId) return
    ;(state as AnconaState).anconaCompanyId = offer.buyer.companyId
    closePrivate(state as Parameters<typeof closePrivate>[0], AnconaLineId)
}

// Every stop's printed value now, for the Ancona bonus's "largest other stop".
function stopValues(state: TrainRunningState): Record<string, number> {
    const mapState = new RailwayMapState(TwoCrownsMap, TwoCrownsTileSet, state.tileInventory)
    const stages = TwoCrownsPhases.phase(state.phaseId).tileColors
    const values: Record<string, number> = {}
    for (const location of TwoCrownsMap.definition.locations) {
        if (location.id === AnconaId) continue
        const amounts = mapState
            .tile(location.id)
            .face.nodes.flatMap((node) =>
                'revenue' in node && node.revenue ? [routeRevenue(node.revenue, stages)] : []
            )
        if (amounts.length) values[location.id] = Math.max(...amounts)
    }
    return values
}

export const AnconaRouteRules = {
    // The buying company's routes to Ancona add the largest other stop (P17).
    revenuePolicy(
        _train: unknown,
        state?: TrainRunningState,
        companyId?: string
    ): RouteRevenuePolicy {
        if (!state || !companyId || (state as AnconaState).anconaCompanyId !== companyId) return {}
        return {
            connectionBonuses: [
                { from: { [AnconaId]: 0 }, to: stopValues(state), sourceId: AnconaLineId }
            ]
        }
    }
}
