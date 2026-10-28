import { TwoCrownsCharters } from './charters.js'
import { EighteenXXTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
import { TwoCrownsPhases } from './trains.js'
import { TwoCrownsPrivateCatalog } from './privates.js'
export const TwoCrownsTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: TwoCrownsCharters,
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        const id = asset.privateCompanyId
        if (privateOwner(state, id)?.kind !== 'player') return undefined
        if (TwoCrownsPhases.isAtLeast(state.phaseId, '4+')) return undefined
        // Ganz may go to any company at any time (1874design.md, Ganz Locomotive Works).
        if (id === 'G') return TwoCrownsPrivateCatalog.priceRange(id)
        // From 4H: the Station Rights to any company, Wiener Neustadt to a non-Luka one.
        if (!TwoCrownsPhases.isAtLeast(state.phaseId, '4H')) return undefined
        if (id === 'P3' || id === 'P4' || (id === 'P10' && companyId !== 'LUKA'))
            return TwoCrownsPrivateCatalog.priceRange(id)
        return undefined
    },
    afterPurchase: () => {}
}
