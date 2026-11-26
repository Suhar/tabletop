import { describe, expect, it } from 'vitest'
import { cubeShape, pileOffsets } from './cubeShape.js'

describe('cube piles', () => {
    it('piles cubes two high, then starts a column in front and to the right', () => {
        const shape = cubeShape(20)
        expect(pileOffsets(3, 20)).toEqual([
            { x: 0, y: 0 },
            { x: 0, y: -shape.rise },
            { x: shape.across.x, y: shape.across.y }
        ])
    })

    it('shows at most four cubes', () => {
        expect(pileOffsets(7, 20)).toHaveLength(4)
    })
})
