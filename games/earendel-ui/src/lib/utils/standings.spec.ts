import { describe, expect, it } from 'vitest'
import { rankStandings } from './standings.js'

describe('rankStandings', () => {
    it('orders by score and gives tied players the same rank', () => {
        const standings = rankStandings(
            [
                { playerId: 'a', score: 12 },
                { playerId: 'b', score: 20 },
                { playerId: 'c', score: 20 }
            ],
            { b: 3, a: 1 }
        )
        expect(standings).toEqual([
            { playerId: 'b', score: 20, planetPoints: 3, rank: 1 },
            { playerId: 'c', score: 20, planetPoints: 0, rank: 1 },
            { playerId: 'a', score: 12, planetPoints: 1, rank: 3 }
        ])
    })
})
