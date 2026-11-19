import { describe, expect, it } from 'vitest'
import { TwoCrownsPhaseChart } from './phaseChart.js'

// 1874design.md, Trade-ins: a supply purchase may hand in a train of the rank just below, never a
// 4+ or a 7, for half its face.
describe('1874 phase chart', () => {
    it('lists each train’s trade-in on its roster row', () => {
        const upgrades = Object.fromEntries(
            TwoCrownsPhaseChart.trains.map((train) => [train.id, train.upgrades])
        )
        expect(upgrades['2H']).toEqual([{ definitionId: '3H', price: 60 }])
        expect(upgrades['6H']).toEqual([{ definitionId: '2+', price: 130 }])
        expect(upgrades['4+']).toEqual([])
        expect(upgrades['7']).toEqual([])
        expect(upgrades['D']).toEqual([])
    })
})
