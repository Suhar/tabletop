import { TwoCrownsCharters } from './charters.js'
import {
    awardCertificates,
    beginOfferPileAuction,
    cashOwnedBy,
    createCompanyStations,
    createOrdinaryShareCertificates,
    drawFirstPlayer,
    getCompany,
    treasuryPool,
    type StockMarket,
    privateIncomePayments,
    type InitialPosition,
    type MapStateData,
    type OfferPileAuctionRules,
    type Opening,
    type OpeningSetup,
    type StartingCashSetup
} from '@tabletop/18xx'
import { assert, shuffle } from '@tabletop/common'
import { addTwoCrownsBranches } from './branches.js'
import { TwoCrownsCompanies, twoCrownsRole } from './companies.js'
import { TwoCrownsParCells } from './generated/data.js'
import { twoCrownsPlayerSetup } from './players.js'
import { TwoCrownsMap } from './map.js'
import { lukaPresident } from './luka.js'
import { TwoCrownsPrivateCatalog, TwoCrownsPrivates, privatesForPlayerCount } from './privates.js'
import type { HydratedTwoCrownsState, TwoCrownsState } from './state.js'
import { TwoCrownsMarket } from './stockMarket.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsTrainDepot } from './trains.js'
import { BondIds, CharterPublicShareNumber, isBond } from './holdings.js'
export const TwoCrownsAuctionRules: OfferPileAuctionRules = {
    increment: 5,
    autoOfferSingleLot: true,
    lots(state) {
        return [
            ...TwoCrownsPrivateCatalog.lots(state).filter(
                (lot) => lot.id !== 'P' && !isBond(lot.id)
            ),
            ...TwoCrownsCompanies.filter((item) =>
                state.companies.some((company) => company.id === item.companyId && !company.role)
            ).map((item) => ({
                id: `LUKA:share:${item.number}`,
                name: `LUKA ${item.number} · ${item.name}`,
                price: 80
            }))
        ]
    },
    award(state, award) {
        if (award.lotId.startsWith('LUKA:')) {
            awardCertificates(state, award, [award.lotId])
            const president = lukaPresident(state)
            if (president)
                getCompany(state, 'LUKA').president = { kind: 'player', playerId: president }
            return
        }
        const mainline = twoCrownsRole(state, 'mainline'),
            shortline = twoCrownsRole(state, 'shortline'),
            publicLine = twoCrownsRole(state, 'narodna')
        const concessions: Record<string, string> = {
            P15: mainline,
            P16: shortline,
            P13: publicLine
        }
        const extras: Record<string, string[]> = {
            P15: [`${mainline}:president`],
            P16: [`${shortline}:president`],
            P13: [`${publicLine}:president`],
            P9: [`${mainline}:share:1`],
            P11: [`${mainline}:share:2`]
        }
        awardCertificates(state, award, [`${award.lotId}:charter`, ...(extras[award.lotId] ?? [])])
        const concession = concessions[award.lotId]
        if (concession)
            getCompany(state, concession).president = { kind: 'player', playerId: award.playerId }
    },
    incomePayments(state) {
        return privateIncomePayments(state, { charters: TwoCrownsCharters }).filter(
            (payment) => payment.to.kind === 'player'
        )
    },
    firstStockOrder(state) {
        const order = [...state.turnManager.turnOrder]
        const index = order.indexOf(state.offerAuction!.auctioneerId)
        const rotated = [...order.slice(index), ...order.slice(0, index)]
        return rotated.sort((a, b) => {
            const first = cashOwnedBy(state, { kind: 'player', playerId: a }),
                second = cashOwnedBy(state, { kind: 'player', playerId: b })
            assert(
                typeof first === 'number' && typeof second === 'number',
                'Players require finite cash'
            )
            return first - second
        })
    }
}
export function twoCrownsStartingCash({ playerCount }: StartingCashSetup): number {
    return twoCrownsPlayerSetup(playerCount).startingCash
}
// At 4–5 players one of the Zadar and Virovitica Station Rights is removed at random.
function dealtPrivateIds(playerCount: number, random: () => number): string[] {
    const ids = privatesForPlayerCount(playerCount)
    if (playerCount < 4) return ids
    const removed = random() < 0.5 ? 'P3' : 'P4'
    return ids.filter((id) => id !== removed)
}
export function createTwoCrownsOpening({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof TwoCrownsState, HydratedTwoCrownsState> {
    assert(
        players.length >= 3 && players.length <= 5,
        'The Two Crowns supports three to five players'
    )
    const shuffled = [...TwoCrownsCompanies]
    shuffle(shuffled, prng.random)
    const [mainline, shortline, narodna, ...remaining] = shuffled
    const dealt = dealtPrivateIds(players.length, prng.random)
    const privates = TwoCrownsPrivates.filter((p) => dealt.includes(p.id))
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    const reserved = { owner: { kind: 'bank' } as const, poolId: 'reserved' }
    const auction = { owner: { kind: 'bank' } as const, poolId: 'auction' }
    const union = { owner: { kind: 'company' as const, companyId: 'P12' } }
    const charter = { owner: { kind: 'company' as const, companyId: 'P14' } }
    const bonds = BondIds.slice(0, players.length)
    // Public Line shares 1..players are the Bonds' reserved shares; the last is the Hungarian Bank's.
    const publicLinePool = (index: number) =>
        index < bonds.length ? reserved : index + 1 === CharterPublicShareNumber ? charter : market
    const lotIds = [
        ...privates.filter((p) => p.id !== 'P').map((p) => p.id),
        ...remaining.map((c) => `LUKA:share:${c.number}`)
    ]
    shuffle(lotIds, prng.random)
    const auctioneerId = drawFirstPlayer(
        players.map((player) => player.playerId),
        prng,
        startingPositions
    )
    const stockMarket: StockMarket = { stacks: [] }
    TwoCrownsMarket.placeMarker(stockMarket, mainline.companyId, TwoCrownsParCells.mainline)
    TwoCrownsMarket.placeMarker(stockMarket, shortline.companyId, TwoCrownsParCells.shortline)
    TwoCrownsMarket.placeMarker(stockMarket, narodna.companyId, TwoCrownsParCells.shortline)
    const stations: MapStateData['stations'] = []
    const stationReservations: MapStateData['stationReservations'] = []
    for (const company of TwoCrownsCompanies) {
        const location = TwoCrownsMap.definition.locations.find((l) =>
            l.reservations?.some((r) => r.companyId === company.companyId)
        )!
        const reservation = location.reservations!.find((r) => r.companyId === company.companyId)!
        const position = { locationId: location.id, nodeId: reservation.nodeId, slot: 0 }
        const main = company.companyId === mainline.companyId
        const [home, ...others] = createCompanyStations(company.companyId, 4)
        stations.push(main ? { ...home, status: 'placed', position } : home, ...others)
        if (!main) stationReservations.push({ ...reservation, locationId: location.id })
        if (remaining.some((c) => c.companyId === company.companyId))
            stations.push({
                id: `LUKA:${company.companyId}`,
                companyId: 'LUKA',
                status: 'placed',
                position
            })
    }
    const position: InitialPosition = {
        bank: {},
        companies: [
            ...TwoCrownsCompanies.map((c) => ({
                id: c.companyId,
                kind: 'major',
                started: c === mainline || c === shortline || c === narodna,
                floated: c === mainline,
                funded: c === mainline,
                operated: false,
                ...(c === mainline
                    ? {
                          role: 'mainline',
                          parPrice: TwoCrownsMarket.space(TwoCrownsParCells.mainline).price
                      }
                    : c === shortline
                      ? {
                            role: 'shortline',
                            parPrice: TwoCrownsMarket.space(TwoCrownsParCells.shortline).price
                        }
                      : c === narodna
                        ? {
                              role: 'narodna',
                              parPrice: TwoCrownsMarket.space(TwoCrownsParCells.shortline).price
                          }
                        : {})
            })),
            { id: 'LUKA', kind: 'major' },
            ...privates.map((p) => ({
                id: p.id,
                kind: 'private'
            })),
            ...bonds.map((id) => ({ id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((p) => ({
                owner: { kind: 'player' as const, playerId: p.playerId },
                amount: twoCrownsStartingCash({ playerCount: players.length, config })
            })),
            ...TwoCrownsCompanies.map((c) => ({
                owner: { kind: 'company' as const, companyId: c.companyId },
                amount: c === mainline ? 920 : 0
            })),
            { owner: { kind: 'company', companyId: 'LUKA' }, amount: 200 },
            { owner: { kind: 'company', companyId: 'P12' }, amount: 0 },
            { owner: { kind: 'company', companyId: 'P14' }, amount: 0 }
        ],
        certificatePools: [
            { id: 'market', owner: { kind: 'bank' } },
            { id: 'reserved', owner: { kind: 'bank' } },
            { id: 'auction', owner: { kind: 'bank' } },
            ...TwoCrownsCompanies.map((c) => treasuryPool(c.companyId))
        ],
        certificates: [
            ...TwoCrownsCompanies.flatMap((c) =>
                createOrdinaryShareCertificates(
                    c.companyId,
                    Array.from({ length: 8 }, (_, index) =>
                        c === mainline
                            ? index < 2
                                ? auction
                                : index === 7
                                  ? union
                                  : market
                            : c === shortline
                              ? index >= 5
                                  ? reserved
                                  : market
                              : c === narodna
                                ? publicLinePool(index)
                                : c === remaining[0] && index === 7
                                  ? union
                                  : market
                    ),
                    c === mainline || c === shortline || c === narodna ? auction : market
                )
            ),
            ...remaining.map((c) => ({
                id: `LUKA:share:${c.number}`,
                companyId: 'LUKA',
                kind: 'share' as const,
                shares: 1,
                number: c.number,
                owner: { kind: 'bank' as const },
                poolId: 'auction'
            })),
            ...privates.map((p) => ({
                id: `${p.id}:charter`,
                companyId: p.id,
                kind: 'private' as const,
                owner:
                    p.id === 'P'
                        ? { kind: 'company' as const, companyId: 'LUKA' }
                        : { kind: 'bank' as const },
                ...(p.id === 'P' ? {} : { poolId: 'auction' })
            })),
            ...bonds.map((id, index) => ({
                id: `${id}:charter`,
                companyId: id,
                kind: 'private' as const,
                owner: { kind: 'player' as const, playerId: players[index].playerId }
            }))
        ],
        tranches: [
            {
                id: 'initial',
                name: 'Mainline, Shortline and Public Line',
                capacity: 3,
                companyIds: [mainline.companyId, shortline.companyId, narodna.companyId]
            },
            { id: '1', name: 'Tranche 1', capacity: 2, companyIds: [] },
            { id: '2', name: 'Tranche 2', capacity: 2, companyIds: [] },
            { id: '3', name: 'Tranche 3', capacity: 3, companyIds: [] }
        ],
        ownershipLimitExemptions: [],
        stations,
        stationReservations,
        stockMarket,
        tileInventory: TwoCrownsTileSet.createInventory(),
        trainInventory: TwoCrownsTrainDepot.createInventory(),
        phaseId: '2H'
    }
    addTwoCrownsBranches(position)
    return {
        position,
        titleState: { unionBankDrawnCompanyId: remaining[0].companyId },
        begin: beginOfferPileAuction({
            piles: players.map((p, index) => ({
                playerId: p.playerId,
                lotIds: lotIds.slice(
                    (index * lotIds.length) / players.length,
                    ((index + 1) * lotIds.length) / players.length
                )
            })),
            auctioneerId,
            awards: [],
            incomePayments: 0,
            stalled: false,
            completed: false
        })
    }
}
