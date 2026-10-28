import type { RouteRules } from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsPhases, TwoCrownsTrainDepot } from './trains.js'
import { BerthRouteRules } from './berths.js'
export const TwoCrownsRouteRules: RouteRules = {
    map: TwoCrownsMap,
    tileSet: TwoCrownsTileSet,
    depot: TwoCrownsTrainDepot,
    revenueStage(state, _train) {
        return TwoCrownsPhases.phase(state.phaseId).tileColors
    },
    requiresCity: (train) => train.distance.measure === 'cities-and-offboards',
    ...BerthRouteRules
}
