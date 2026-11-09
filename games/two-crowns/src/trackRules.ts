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
import { TwoCrownsTileSet, TwoCrownsTiles } from './tiles.js'
import { TwoCrownsPhases } from './trains.js'
import type { TileFace } from '@tabletop/18xx'

const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length
const KarlovacId = 'I11'
const AnyCityGrayIds = ['two-crowns:G1', 'two-crowns:G2']
// The gray city the Lika Survey Office holds (1874design.md, P8).
const LikaTileId = 'two-crowns:G2'
// 1874design.md, Junction cities and Gray tiles: a green junction splits into the brown J tile's
// two cities, and a gray city may join a brown junction back into one.
export function preservesTwoCrownsStops(before: TileFace, after: TileFace): boolean {
    if (sameStopCounts(before, after)) return true
    const towns = (face: TileFace) => face.nodes.filter((node) => node.kind === 'town').length
    if (towns(before) !== towns(after)) return false
    if (after.labels?.includes('J')) return cityCount(before) === 1 && cityCount(after) === 2
    return after.color === 'gray' && cityCount(before) === 2 && cityCount(after) === 1
}
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
    preservesStops: preservesTwoCrownsStops,
    relabels(locationId, definitionId) {
        // The gray cities go on any brown city but Karlovac, labelled or junction included.
        if (AnyCityGrayIds.includes(definitionId)) return locationId !== KarlovacId
        // A J or S hex takes plain tiles until its label applies (brown for J, green for S).
        const tile = TwoCrownsTiles.find((item) => item.id === definitionId)
        const label = TwoCrownsMap.definition.locations.find((item) => item.id === locationId)
            ?.upgradeLabels?.[0]
        if (!tile || !label || tile.face.labels?.length) return false
        const order = TwoCrownsTrackRules.colorOrder
        return order.indexOf(tile.face.color) < order.indexOf(label.color)
    },
    useful: ({ newTrack, increasedCityRevenue }) => newTrack || increasedCityRevenue,
    homeLocations: (companyId) => TwoCrownsMap.reservedLocationIds(companyId),
    consentPlayerId: () => undefined,
    restriction(state, request) {
        // In the final 3 ORs only the gray tiles may be laid (1874design.md, Trains and phases).
        const { gameEnding, operatingSet } = state as {
            gameEnding?: { finalOperatingSet?: number }
            operatingSet?: { number: number }
        }
        if (
            gameEnding?.finalOperatingSet !== undefined &&
            (operatingSet?.number ?? 0) >= gameEnding.finalOperatingSet &&
            TwoCrownsTiles.find((tile) => tile.id === request.definitionId)?.face.color !== 'gray'
        )
            return 'In the final operating rounds only the gray tiles may be laid'
        const blocker = TwoCrownsPrivateCatalog.blockedBy(state, request.locationId)
        if (blocker) return `${blocker.name} blocks this hex`
        const controller = controllingOwner(state, request.companyId)
        if (request.definitionId === LikaTileId) {
            const privateCompany = state.companies.find((company) => company.id === 'P8')
            const owner =
                privateCompany && !privateCompany.closed ? privateOwner(state, 'P8') : undefined
            if (!controller || !owner || !sameOwner(controller, owner))
                return 'Tile G2 requires the Lika Survey Office'
        }
        return undefined
    }
}
