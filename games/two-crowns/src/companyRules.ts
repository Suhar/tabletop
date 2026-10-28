import { TwoCrownsCharters } from './charters.js'
import { TwoCrownsMarket } from './stockMarket.js'
import {
    applyPresidencyChange,
    applyStationPlacement,
    closePrivate,
    evaluatePresidency,
    exchangeCertificate,
    fullCapitalizationPayments,
    getCompany,
    grantOwnershipLimitExemption,
    homeStationId,
    nextCompanyTranche,
    presidentCertificate,
    releaseTrains,
    replaceStation,
    sameOwner,
    sharesStillToFloat,
    trainsOwnedBy,
    type CompanyRules,
    type FormationState,
    type StockState
} from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import { lukaCompanies } from './companies.js'
import { lukaPresident } from './luka.js'
import { TwoCrownsStockRules, twoCrownsPurchasePayers } from './stockRules.js'
import { TwoCrownsPhases } from './trains.js'
import { isHeldShare } from './holdings.js'

function releasesNextTranche(state: FormationState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        !!company.operated ||
        state.certificates.every(
            (certificate) =>
                certificate.kind !== 'share' ||
                certificate.companyId !== companyId ||
                isHeldShare(certificate)
        )
    )
}
export function nextTwoCrownsTranche(state: FormationState) {
    assertExists(state.tranches, 'Company formation requires tranches')
    return nextCompanyTranche(state.tranches, (companyId) => releasesNextTranche(state, companyId))
}
export function availableTwoCrownsTranche(state: FormationState) {
    const next = nextTwoCrownsTranche(state)
    return next?.waitingCompanyIds.length === 0 ? next.tranche : undefined
}
// The Late space is the last space of the bottom tranche row (1874design.md, Late space).
export function inLateSpace(state: FormationState): boolean {
    const tranche = availableTwoCrownsTranche(state)
    return (
        !!tranche &&
        tranche === state.tranches?.at(-1) &&
        tranche.companyIds.length === tranche.capacity - 1
    )
}
export function twoCrownsStartMarketSpaces(state: StockState, late = false): string[] {
    const reached = (phaseId: string) => TwoCrownsPhases.isAtLeast(state.phaseId, phaseId)
    // A Late-space company may also start one space above the phase's highest start price.
    const minimumRow =
        (reached('7') ? 6 : reached('3+') ? 5 : reached('5H') ? 4 : 3) - (late ? 1 : 0)
    return TwoCrownsMarket.spaces
        .filter((space) => space.column === 1 && space.row >= minimumRow)
        .map((space) => space.id)
}
export const TwoCrownsCompanyRules: CompanyRules = {
    startMarketSpaces(state, companyId) {
        if (!lukaCompanies(state).some((item) => item.companyId === companyId)) return []
        return twoCrownsStartMarketSpaces(state, inLateSpace(state))
    },
    startTerms(state, companyId, buyer, marketSpaceId) {
        if (!availableTwoCrownsTranche(state)) return 'No company tranche is available.'
        const association = lukaCompanies(state).find((item) => item.companyId === companyId)
        if (!association) return 'This company requires a different formation procedure.'
        const luka = state.certificates.find(
            (certificate) => certificate.id === association.lukaCertificateId
        )
        if (!luka || luka.owner.kind !== 'player')
            return 'The associated LUKA share must be owned by a player.'
        const certificate = presidentCertificate(state, companyId)
        if (!certificate || certificate.owner.kind !== 'bank' || certificate.poolId !== 'market')
            return 'The president’s certificate must be available from the Bank.'
        return {
            price: TwoCrownsMarket.space(marketSpaceId).price * 2,
            recipient: { kind: 'bank' },
            payers: twoCrownsPurchasePayers(state, buyer)
        }
    },
    onStart(state, details) {
        const tranche = availableTwoCrownsTranche(state)
        assertExists(tranche, 'Company start requires a tranche space')
        tranche.companyIds.push(details.companyId)
    },
    sharesToFloat: (state, companyId) =>
        sharesStillToFloat(
            state,
            TwoCrownsCharters,
            companyId,
            60,
            (certificate) => certificate.owner.kind === 'bank' && certificate.poolId !== 'reserved'
        ),
    flotationPayments: (state, companyId) =>
        fullCapitalizationPayments(
            state,
            TwoCrownsCharters,
            companyId,
            TwoCrownsCompanyRules.sharesToFloat?.(state, companyId)
        ),
    onFloat(state, companyId) {
        const association = lukaCompanies(state).find((item) => item.companyId === companyId)
        if (!association) {
            const role = getCompany(state, companyId).role
            if (role === 'shortline' || role === 'narodna') {
                const reservation = state.stationReservations.find((r) => r.companyId === companyId)
                assertExists(reservation, 'A leased line requires its reserved home')
                applyStationPlacement(state, {
                    stationId: homeStationId(companyId),
                    companyId,
                    position: {
                        locationId: reservation.locationId,
                        nodeId: reservation.nodeId,
                        slot: 0
                    },
                    cost: 0
                })
            }
            return
        }
        const replacement = state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                !certificate.president &&
                certificate.shares === 1 &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === 'market'
        )
        assertExists(replacement, 'LUKA exchange requires an ordinary Bank share')
        const exchange = exchangeCertificate(state, association.lukaCertificateId, replacement.id)
        grantOwnershipLimitExemption(state, TwoCrownsCharters, companyId, exchange.owner)
        const presidency = evaluatePresidency(
            state,
            companyId,
            TwoCrownsStockRules.presidencyCandidates(state, companyId)
        )
        assert(!presidency.reason, presidency.reason ?? 'Invalid presidency exchange')
        if (presidency.change) applyPresidencyChange(state, presidency.change)
        replaceStation(state, `LUKA:${companyId}`, homeStationId(companyId))
        state.stationReservations = state.stationReservations.filter(
            (reservation) => reservation.companyId !== companyId
        )
        const luka = getCompany(state, 'LUKA')
        const president = lukaPresident(state)
        if (president) luka.president = { kind: 'player', playerId: president }
        else {
            luka.closed = true
            delete luka.president
            const cash = state.cash.find((cash) =>
                sameOwner(cash.owner, { kind: 'company', companyId: 'LUKA' })
            )
            assertExists(cash, 'LUKA requires a treasury')
            cash.amount = 0
            releaseTrains(
                state.trainInventory,
                trainsOwnedBy(state, cash.owner).map((train) => train.id),
                'removed'
            )
            closePrivate(state, 'P')
        }
        return [exchange]
    }
}
