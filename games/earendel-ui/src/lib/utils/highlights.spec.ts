import { describe, expect, it } from 'vitest'
import { highlightedHexesOf, HighlightPrecedence, type ActiveHighlights } from './highlights.js'

const hexFor = (index: number) => [{ q: index, r: 0 }]

describe('highlightedHexesOf', () => {
    it('shows only the highest active layer, in the documented order', () => {
        HighlightPrecedence.forEach((winner, index) => {
            const active: ActiveHighlights = {}
            HighlightPrecedence.slice(index).forEach((layer, offset) => {
                active[layer] = hexFor(index + offset)
            })
            expect(highlightedHexesOf(active), winner).toEqual(hexFor(index))
        })
    })

    it('keeps an active layer with no hexes in charge rather than falling through', () => {
        expect(highlightedHexesOf({ tileOrigins: [], placement: hexFor(1) })).toEqual([])
    })

    it('is empty when nothing is active', () => {
        expect(highlightedHexesOf({})).toEqual([])
    })
})
