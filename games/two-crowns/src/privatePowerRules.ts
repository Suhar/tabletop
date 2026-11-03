import {
    privateOwner,
    EighteenXXTransferTiming,
    controllingOwner,
    type PrivatePowerRules
} from '@tabletop/18xx'
import { TwoCrownsTiles } from './tiles.js'

// Zadar and Virovitica Station Rights (1874design.md, P3 and P4): the owning company may lay or
// upgrade the city without a connection as its first lay, then place its cheapest station free.
const StationRightsLocations: Readonly<Record<string, string>> = { P3: 'H20', P4: 'P8' }
const PlainCityTileIds = TwoCrownsTiles.filter(
    (tile) =>
        ['yellow', 'green'].includes(tile.face.color) &&
        tile.face.nodes.filter((node) => node.kind === 'city').length === 1 &&
        !tile.face.labels?.length
).map((tile) => tile.id)

export const TwoCrownsPrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        const locationId = StationRightsLocations[privateCompanyId]
        if (!locationId) return undefined
        if (state.companies.find((company) => company.id === privateCompanyId)?.closed)
            return undefined
        const owner = privateOwner(state, privateCompanyId)
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        if (
            owner?.kind !== 'company' ||
            owner.companyId !== companyId ||
            controllingOwner(state, companyId)?.playerId !== playerId ||
            state.machineState !== 'LayingTrack' ||
            state.trackStep?.companyId !== companyId ||
            state.trackStep.lays.length > 0
        )
            return undefined
        return {
            companyId,
            locationIds: [locationId],
            definitionIds: PlainCityTileIds,
            payer: owner,
            connected: false,
            countsAsOrdinaryLay: true,
            reusable: true
        }
    },
    stationPrivateIds: ['P3', 'P4'],
    earlyTrainCompany(state, privateCompanyId, playerId) {
        // Wiener Neustadt and Ganz each buy one train at any point in the owning company's turn.
        if (
            (privateCompanyId !== 'P10' && privateCompanyId !== 'G') ||
            !state.companies.some((company) => company.id === privateCompanyId && !company.closed)
        )
            return undefined
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        const owner = privateOwner(state, privateCompanyId)
        return companyId &&
            (companyId !== 'LUKA' || privateCompanyId === 'G') &&
            owner?.kind === 'company' &&
            owner.companyId === companyId &&
            controllingOwner(state, companyId)?.playerId === playerId
            ? companyId
            : undefined
    }
}
