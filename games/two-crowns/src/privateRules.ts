import { TwoCrownsNames } from './names.js'
import { twoCrownsRole } from './companies.js'
import { TwoCrownsTileSet } from './tiles.js'
import { assert, assertExists } from '@tabletop/common'
import {
    certificatesOwnedBy,
    type PrivateRules,
    type PrivateEffect,
    type FinancialState,
    type StockState
} from '@tabletop/18xx'
import type { TwoCrownsState } from './state.js'
import { TwoCrownsPhases } from './trains.js'
import { TwoCrownsPrivateCatalog } from './privates.js'
const ShortlineExchanges: Record<string, number> = { P1: 6, P2: 7, P7: 8 }
function shortlineExchange(state: FinancialState, id: string) {
    return ShortlineExchanges[id]
        ? `${twoCrownsRole(state, 'shortline')}:share:${ShortlineExchanges[id]}`
        : undefined
}
type UnionBankState = FinancialState & Pick<TwoCrownsState, 'unionBankDrawnCompanyId'>
export function unionBankStartingCompanyIds(state: UnionBankState): string[] {
    const mainline = twoCrownsRole(state, 'mainline')
    const drawn =
        state.unionBankDrawnCompanyId ??
        certificatesOwnedBy(state, { kind: 'company', companyId: 'P12' }).find(
            (certificate) => certificate.kind === 'share' && certificate.companyId !== mainline
        )?.companyId
    return drawn ? [mainline, drawn] : [mainline]
}
function unionBankIntro(state: UnionBankState) {
    const [mainline, drawn] = unionBankStartingCompanyIds(state).map((companyId) =>
        TwoCrownsNames.company(companyId)
    )
    return drawn
        ? `**Includes one share each of ${mainline} and ${drawn}.**\n\n`
        : `**Includes one share of ${mainline}.**\n\n`
}
export const TwoCrownsPrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (TwoCrownsPhases.isAtLeast(state.phaseId, '4+')) return undefined
        const reservedId = shortlineExchange(state, privateCompanyId)
        if (reservedId)
            return {
                certificateIds: state.certificates
                    .filter(
                        (item) =>
                            item.id === reservedId &&
                            item.owner.kind === 'bank' &&
                            item.poolId === 'reserved'
                    )
                    .map((item) => item.id),
                timing: 'own-stock-turn',
                stockAction: 'additional',
                ownershipLimit: 'exempt'
            }
        return undefined
    },
    phaseEffects(state) {
        const due = TwoCrownsPrivateCatalog.closureEffects(state)
        return [
            ...['P1', 'P2', 'P7'].flatMap((id) =>
                due.filter((effect) => effect.privateCompanyId === id)
            ),
            ...due.filter((effect) => !ShortlineExchanges[effect.privateCompanyId])
        ].map((effect): PrivateEffect => {
            const company = { id: effect.privateCompanyId }
            const certificateId = shortlineExchange(state, company.id)
            if (!certificateId)
                return {
                    kind: 'close',
                    privateCompanyId: company.id,
                    ...(company.id === 'P8'
                        ? {
                              retireUnplacedPieceIds: TwoCrownsTileSet.availablePieces(
                                  state.tileInventory,
                                  '18xx:9'
                              ).map((piece) => piece.id)
                          }
                        : {})
                }
            const share = state.certificates.find(
                (item) =>
                    item.id === certificateId &&
                    item.owner.kind === 'bank' &&
                    item.poolId === 'reserved'
            )
            assertExists(share, 'Open Shortline exchange requires its reserved share')
            assert(share.kind === 'share', 'Open Shortline exchanges for a share')
            return {
                kind: 'exchange',
                privateCompanyId: company.id,
                certificateId,
                companyId: share.companyId,
                shares: share.shares,
                exemptOwnershipLimit: true
            }
        })
    },
    operationEffects(state, companyId) {
        const id =
            companyId === twoCrownsRole(state, 'mainline')
                ? 'P15'
                : companyId === twoCrownsRole(state, 'shortline')
                  ? 'P16'
                  : undefined
        return state.companies
            .filter((company) => company.id === id && !company.closed)
            .map((company) => ({ kind: 'close', privateCompanyId: company.id }))
    },
    description(state: StockState & UnionBankState, id) {
        if (ShortlineExchanges[id]) {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'shortline'))
            return (
                `**Includes one reserved share of ${company}.**\n\n` +
                'Exchange for a reserved Shortline share during your stock turn, in addition to selling and buying. Cancels your pass. Ownership limit exemption applies.\n\nForced exchange at 4+.'
            )
        }
        if (id === 'P9' || id === 'P11') {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'mainline'))
            return `**Includes one share of ${company}.**\n\nCloses at 4+.`
        }
        if (id === 'P15' || id === 'P16') {
            const company = TwoCrownsNames.company(
                twoCrownsRole(state, id === 'P15' ? 'mainline' : 'shortline')
            )
            return `**Includes the president's cert for ${company}.**\n\nCloses when its railway first operates, or at 4+.`
        }
        const description = TwoCrownsPrivateCatalog.definition(id).description ?? 'Closes at 4+.'
        return id === 'P12' ? unionBankIntro(state) + description : description
    }
}
