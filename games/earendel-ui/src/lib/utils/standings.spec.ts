import { describe, expect, it } from 'vitest'
import { rankStandings } from './standings.js'

describe('rankStandings', () => {
    it('orders by score and gives tied players the same rank', () => {
        const standings = rankStandings([
            { playerId: 'a', score: 12 },
            { playerId: 'b', score: 20 },
            { playerId: 'c', score: 20 }
        ])
        expect(standings).toEqual([
            { playerId: 'b', score: 20, rank: 1 },
            { playerId: 'c', score: 20, rank: 1 },
            { playerId: 'a', score: 12, rank: 3 }
        ])
    })
})
