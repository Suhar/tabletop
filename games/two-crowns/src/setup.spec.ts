import { describe, expect, it } from 'vitest'
import { GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition } from './definition/gameDefinition.js'
import { twoCrownsRole } from './companies.js'

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
})
