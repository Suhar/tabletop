import { describe, expect, it } from 'vitest'
import { GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition } from './definition/gameDefinition.js'
import { twoCrownsRole } from './companies.js'
import { FirstDealtPrivateIds, dealAuctionPiles } from './openingAuction.js'
import { TwoCrownsPrivateCatalog } from './privates.js'
import { TwoCrownsTrackRules } from './trackRules.js'

export function startTwoCrowns(playerCount: number, seed = 1) {
    const game = Definition.runtime.initializer.initializeGame(
        {
            id: `setup-${playerCount}-${seed}`,
            typeId: Definition.info.id,
            name: 'Setup',
            ownerId: 'test',
            storage: GameStorage.Local,
            hotseat: true,
            seed,
            config: {},
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index + 1}`,
                name: `p${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return new GameEngine({ ...Definition.runtime, randomnessVersion: undefined }).startGame(game)
        .initialState
}

describe('1874 setup', () => {
    it.each([3, 4, 5])('deals the three lines and a Bond each at %i players', (count) => {
        const state = startTwoCrowns(count)
        const publicLine = twoCrownsRole(state, 'narodna')
        const company = state.companies.find((item) => item.id === publicLine)!
        expect(company.started).toBe(true)
        expect(company.parPrice).toBe(86)
        const shares = state.certificates.filter((item) => item.companyId === publicLine)
        expect(shares.filter((item) => item.poolId === 'reserved')).toHaveLength(count)
        expect(
            shares.filter((item) => item.owner.kind === 'company' && item.owner.companyId === 'P14')
        ).toHaveLength(1)
        const bonds = state.certificates.filter((item) => /^BD\d:charter$/.test(item.id))
        expect(bonds.map((item) => item.owner.kind === 'player' && item.owner.playerId)).toEqual(
            state.players.map((player) => player.playerId)
        )
        expect(state.tranches?.[0].companyIds).toHaveLength(3)
        const lots = state.offerAuction!.piles.flatMap((pile) => pile.lotIds)
        expect(lots).toHaveLength(count === 3 ? 21 : 20)
        expect(lots.some((id) => id.startsWith('BD'))).toBe(false)
    })

    it.each([4, 5])(
        'removes one of the Station Rights and the Rijeka Lazaretto at random at %i players',
        (count) => {
            const removed = new Set<string>()
            for (let seed = 1; seed <= 30; seed++) {
                const lots = startTwoCrowns(count, seed).offerAuction!.piles.flatMap(
                    (pile) => pile.lotIds
                )
                const missing = ['P3', 'P4', 'P5'].filter((id) => !lots.includes(id))
                expect(missing).toHaveLength(1)
                removed.add(missing[0])
            }
            expect([...removed].sort()).toEqual(['P3', 'P4', 'P5'])
        }
    )

    it('deals the Station Rights and the Rijeka Lazaretto at 3 players', () => {
        const lots = startTwoCrowns(3).offerAuction!.piles.flatMap((pile) => pile.lotIds)
        expect(['P3', 'P4', 'P5'].filter((id) => lots.includes(id))).toHaveLength(3)
    })

    it.each([3, 4, 5])('deals the concessions and banks first at %i players', (count) => {
        for (const seed of [1, 2, 3]) {
            const piles = startTwoCrowns(count, seed).offerAuction!.piles.map((pile) => pile.lotIds)
            // Dealt round the table: pile i holds deal positions i, i + count, ...
            const order = piles[0].flatMap((_, round) =>
                piles.map((pile) => pile[round]).filter(Boolean)
            )
            expect(new Set(order.slice(0, 5))).toEqual(new Set(FirstDealtPrivateIds))
            expect(new Set(piles.map((pile) => pile.length)).size).toBe(1)
        }
    })

    it('keeps every lot when dealing', () => {
        const lots = ['P1', 'P12', 'P13', 'P14', 'P15', 'P16', 'P2', 'P3']
        const piles = dealAuctionPiles(lots, 4, () => 0.5)
        expect(piles.flat().sort()).toEqual([...lots].sort())
        expect(piles.map((pile) => pile.length)).toEqual([2, 2, 2, 2])
    })

    it('blocks L6 while a player holds the Sava River Bridge', () => {
        const state = startTwoCrowns(3)
        const bridge = state.certificates.find((item) => item.companyId === 'P1')!
        bridge.owner = { kind: 'player', playerId: 'p1' }
        delete bridge.poolId
        expect(TwoCrownsPrivateCatalog.blockedBy(state, 'L6')?.id).toBe('P1')
        state.companies.find((item) => item.id === 'P1')!.closed = true
        expect(TwoCrownsPrivateCatalog.blockedBy(state, 'L6')).toBeUndefined()
    })

    it('keeps the Lika Survey Office open at the 4+ and reserves G2 for its owner', () => {
        expect(TwoCrownsPrivateCatalog.definition('P8').closure).toBe('never')
        const state = startTwoCrowns(3)
        const mainline = twoCrownsRole(state, 'mainline')
        state.companies.find((item) => item.id === mainline)!.president = {
            kind: 'player',
            playerId: 'p1'
        }
        const request = { companyId: mainline, locationId: 'K7', definitionId: 'two-crowns:G2' }
        expect(TwoCrownsTrackRules.restriction!(state, request as never)).toBe(
            'Tile G2 requires the Lika Survey Office'
        )
        const lika = state.certificates.find((item) => item.companyId === 'P8')!
        lika.owner = { kind: 'player', playerId: 'p1' }
        delete lika.poolId
        expect(TwoCrownsTrackRules.restriction!(state, request as never)).toBeUndefined()
    })
})
