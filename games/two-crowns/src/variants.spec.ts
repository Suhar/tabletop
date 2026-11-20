import { describe, expect, it } from 'vitest'
import { charterConversionReason } from './charterConversion.js'
import { startTwoCrowns } from './setup.spec.js'
import { TwoCrownsTrainDepot, TwoCrownsTrainRules } from './trains.js'

const sixH = (state: ReturnType<typeof startTwoCrowns>) =>
    TwoCrownsTrainDepot.remaining(state.trainInventory, '6H')
const tradeIn = (state: ReturnType<typeof startTwoCrowns>) =>
    TwoCrownsTrainRules.exchangePrice!(state, 'MAV', '6H', {
        id: 'x',
        definitionId: '5H',
        status: 'owned'
    } as never)

describe('1874 variant rules', () => {
    it('plays the standard game without options', () => {
        const state = startTwoCrowns(4)
        expect(state.variants).toBeUndefined()
        expect(sixH(state)).toBe(3)
        expect(tradeIn(state)).toBe(100)
    })
    it('turns trade-ins off with No trade-ins', () => {
        const state = startTwoCrowns(4, 1, { noTradeIns: true })
        expect(state.variants).toEqual({ noTradeIns: true })
        expect(tradeIn(state)).toBeUndefined()
        expect(sixH(state)).toBe(3)
    })
    it('adds a fourth 6H with Extra 6H', () => {
        const state = startTwoCrowns(4, 1, { extraSixH: true })
        expect(state.variants).toEqual({ extraSixH: true })
        expect(sixH(state)).toBe(4)
        expect(TwoCrownsTrainDepot.remaining(state.trainInventory, '5H')).toBe(4)
        expect(tradeIn(state)).toBe(100)
        TwoCrownsTrainDepot.validateInventory(
            state.trainInventory,
            state.companies.map((company) => company.id),
            state.players.map((player) => player.playerId)
        )
    })
})

describe('1874 Hungarian Bank conversion', () => {
    it('is open until the first 3+, not just the first 2+', () => {
        const state = startTwoCrowns(4)
        const bank = state.certificates.find(
            (item) => item.companyId === 'P14' && item.kind === 'private'
        )!
        bank.owner = { kind: 'player', playerId: 'p1' }
        Object.assign(state, {
            machineState: 'StockRound',
            activePlayerIds: ['p1'],
            stockRound: { ...state.stockRound, completed: false }
        })
        const reason = () => charterConversionReason(state as never, 'p1')
        state.phaseId = '2+'
        expect(reason()).toBeUndefined()
        state.phaseId = '3+'
        expect(reason()).toBe('The Hungarian Bank can no longer convert once a 3+ is bought.')
    })
})
