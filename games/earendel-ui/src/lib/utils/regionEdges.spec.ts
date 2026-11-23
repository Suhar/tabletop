import { describe, expect, it } from 'vitest'
import { neighborsOf } from '@tabletop/earendel'
import { regionEdges } from './regionEdges.js'

const count = (path: string) => (path === '' ? 0 : path.split('M').length - 1)

describe('regionEdges', () => {
    it('gives a lone hex six outer edges and none inside', () => {
        const edges = regionEdges([{ q: 0, r: 0 }])
        expect(count(edges.outer)).toBe(6)
        expect(count(edges.inner)).toBe(0)
    })

    it('rings a hex and its six neighbors with eighteen outer edges around twelve inner', () => {
        const center = { q: 0, r: 0 }
        const edges = regionEdges([center, ...neighborsOf(center)])
        expect(count(edges.outer)).toBe(18)
        expect(count(edges.inner)).toBe(12)
    })

    it('counts a hex named twice once', () => {
        const edges = regionEdges([
            { q: 0, r: 0 },
            { q: 0, r: 0 }
        ])
        expect(count(edges.outer)).toBe(6)
    })
})
