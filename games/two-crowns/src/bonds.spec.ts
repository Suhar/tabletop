import { describe, expect, it } from 'vitest'
import { startTwoCrowns } from './setup.spec.js'
import { twoCrownsRole } from './companies.js'
import { TwoCrownsEarningsRules } from './earningsRules.js'
import { TwoCrownsPrivateRules } from './privateRules.js'
import { TwoCrownsPrivateCatalog } from './privates.js'

// 0.8.0 (1874design.md, Public Line Bond): Bonds pay $10, exchange from the first stock round, and
// their reserved shares work as the Shortline's exchange shares do.
describe('1874 Public Line Bonds', () => {
    it('exchange for their reserved share before 4H', () => {
        const state = startTwoCrowns(4)
        expect(state.phaseId).toBe('2H')
        const terms = TwoCrownsPrivateRules.exchangeTerms(state, 'BD1')
        expect(terms?.certificateIds).toHaveLength(1)
    })

    it('pay $10 an operating round', () => {
        expect(TwoCrownsPrivateCatalog.definition('BD1').revenue).toBe(10)
    })

    it('leave the dividends of their reserved shares to no one', () => {
        const state = startTwoCrowns(4)
        const publicLine = twoCrownsRole(state, 'narodna')
        const shortline = twoCrownsRole(state, 'shortline')
        const entitlements = TwoCrownsEarningsRules.entitlements(state, publicLine)
        // The president's 20% (unsold, in the bank before the auction) and the market shares pay
        // the company; the four reserved Bond shares pay no one.
        const paid = entitlements.reduce((sum, entry) => sum + entry.shares, 0)
        expect(paid).toBe(10 - 4)
        const shortlinePaid = TwoCrownsEarningsRules.entitlements(state, shortline).reduce(
            (sum, entry) => sum + entry.shares,
            0
        )
        expect(shortlinePaid).toBe(10 - 3)
    })
})
