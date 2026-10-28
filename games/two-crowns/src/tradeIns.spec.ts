import { describe, expect, it } from 'vitest'
import { tradeInPrice } from './trains.js'

describe('1874 trade-ins', () => {
    it('credits half the face of the rank just below', () => {
        expect(tradeInPrice('3H', '2H')).toBe(60)
        expect(tradeInPrice('6H', '5H')).toBe(100)
        expect(tradeInPrice('2+', '6H')).toBe(130)
        expect(tradeInPrice('3+', '2+')).toBe(130)
        expect(tradeInPrice('D', '7')).toBe(350)
    })
    it('refuses other ranks, the 4+, and the first train', () => {
        expect(tradeInPrice('6H', '4H')).toBeUndefined()
        expect(tradeInPrice('7', '4+')).toBeUndefined()
        expect(tradeInPrice('2H', '2H')).toBeUndefined()
        expect(tradeInPrice('4+', '3+')).toBe(80)
    })
})
