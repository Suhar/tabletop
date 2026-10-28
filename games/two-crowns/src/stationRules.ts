import type { StationRules } from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsTileSet } from './tiles.js'
export const TwoCrownsStationRules: StationRules = {
    map: TwoCrownsMap,
    tileSet: TwoCrownsTileSet,
    placementCost: () => 80,
    placementLimit: (_state, companyId) => (companyId === 'LUKA' ? 0 : 1),
    pendingHomes: () => [],
    reservationOccupant: (reservation) => `LUKA:${reservation.companyId}`
}
