import {
    sameStopCounts,
    privateOwner,
    controllingOwner,
    sameOwner,
    type TrackRules,
    laidTileFace
} from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsPrivateCatalog } from './privates.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsPhases } from './trains.js'
export const TwoCrownsTrackRules: TrackRules = {
    map: TwoCrownsMap,
    tileSet: TwoCrownsTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => TwoCrownsPhases.phase(state.phaseId).tileColors,
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (
            lays.length === 1 &&
            laidTileFace(state, TwoCrownsTrackRules, lays[0]).color === 'yellow' &&
            color === 'yellow'
        )
            return { cost: 20 }
        return { reason: 'A company may lay two yellow tiles or make one upgrade' }
    },
    preservesStops: sameStopCounts,
    useful: ({ newTrack, increasedCityRevenue }) => newTrack || increasedCityRevenue,
    homeLocations: (companyId) => TwoCrownsMap.reservedLocationIds(companyId),
    consentPlayerId: () => undefined,
    restriction(state, request) {
        const blocker = TwoCrownsPrivateCatalog.blockedBy(state, request.locationId)
        if (blocker) return `${blocker.name} blocks this hex`
        const controller = controllingOwner(state, request.companyId)
        if (request.definitionId === '18xx:9') {
            const privateCompany = state.companies.find((company) => company.id === 'P8')
            const owner =
                privateCompany && !privateCompany.closed ? privateOwner(state, 'P8') : undefined
            if (!controller || !owner || !sameOwner(controller, owner))
                return 'The straight yellow tile requires the Lika Survey Office'
        }
        return undefined
    }
}
