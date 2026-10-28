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
        return asset.privateCompanyId === 'P10' &&
            companyId !== 'LUKA' &&
            TwoCrownsPhases.isAtLeast(state.phaseId, '4H') &&
            !TwoCrownsPhases.isAtLeast(state.phaseId, '4+') &&
            privateOwner(state, 'P10')?.kind === 'player'
            ? TwoCrownsPrivateCatalog.priceRange('P10')
            : undefined
    },
    afterPurchase: () => {}
}
