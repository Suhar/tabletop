import { TwoCrownsNames } from './names.js'
import { twoCrownsRole } from './companies.js'
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
import { bondShareNumber, isBond } from './holdings.js'
const ShortlineExchanges: Record<string, number> = { P1: 6, P2: 7, P7: 8 }
// The reserved share a private exchanges for: a Shortline share, or a Bond's Public Line share.
function shortlineExchange(state: FinancialState, id: string) {
    if (isBond(id)) return `${twoCrownsRole(state, 'narodna')}:share:${bondShareNumber(id)}`
    return ShortlineExchanges[id]
        ? `${twoCrownsRole(state, 'shortline')}:share:${ShortlineExchanges[id]}`
        : undefined
}
const isExchangePrivate = (id: string) => isBond(id) || !!ShortlineExchanges[id]
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
    // The map's Station Rights markers stay while these block their cities.
    blocking: TwoCrownsPrivateCatalog.blocking.bind(TwoCrownsPrivateCatalog),
    exchangeTerms(state, privateCompanyId) {
        if (TwoCrownsPhases.isAtLeast(state.phaseId, '4+')) return undefined
        // Bonds exchange from the first stock round, as the Shortline's privates do (1874design.md, Public Line Bond).
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
            ...due.filter((effect) => isExchangePrivate(effect.privateCompanyId)),
            ...due.filter((effect) => !isExchangePrivate(effect.privateCompanyId))
        ].map((effect): PrivateEffect => {
            const company = { id: effect.privateCompanyId }
            const certificateId = shortlineExchange(state, company.id)
            if (!certificateId) return { kind: 'close', privateCompanyId: company.id }
            const share = state.certificates.find(
                (item) =>
                    item.id === certificateId &&
                    item.owner.kind === 'bank' &&
                    item.poolId === 'reserved'
            )
            assertExists(share, 'Open exchange private requires its reserved share')
            assert(share.kind === 'share', 'Exchange privates exchange for a share')
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
                  : companyId === twoCrownsRole(state, 'narodna')
                    ? 'P13'
                    : undefined
        return state.companies
            .filter((company) => company.id === id && !company.closed)
            .map((company) => ({ kind: 'close', privateCompanyId: company.id }))
    },
    description(state: StockState & UnionBankState, id) {
        if (isBond(id)) {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'narodna'))
            return (
                `**Includes one reserved share of ${company}.**\n\n` +
                "Can't be sold. From 4H, may be exchanged for the share on your stock turn, in addition to your action.\n\nExchanged at the first 4+."
            )
        }
        if (id === 'P13') {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'narodna'))
            return `**Includes the president's certificate of ${company}.**\n\nCloses when it first operates.`
        }
        if (ShortlineExchanges[id]) {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'shortline'))
            return (
                `**Includes one reserved share of ${company}.**\n\n` +
                (id === 'P1' ? 'Blocks L6. ' : '') +
                'May be exchanged for the share on your stock turn, in addition to your action; exempt from the 60% limit.\n\nExchanged at the first 4+.'
            )
        }
        if (id === 'P9' || id === 'P11') {
            const company = TwoCrownsNames.company(twoCrownsRole(state, 'mainline'))
            return `**Includes one share of ${company}.**\n\nCloses at the first 4+.`
        }
        if (id === 'P15' || id === 'P16') {
            const company = TwoCrownsNames.company(
                twoCrownsRole(state, id === 'P15' ? 'mainline' : 'shortline')
            )
            return `**Includes the president's certificate of ${company}.**\n\nCloses when it first operates.`
        }
        const description = TwoCrownsPrivateCatalog.definition(id).description ?? 'Closes at 4+.'
        if (id === 'P14')
            return `**Includes one share of ${TwoCrownsNames.company(twoCrownsRole(state, 'narodna'))}.**\n\n${description}`
        return id === 'P12' ? unionBankIntro(state) + description : description
    }
}
