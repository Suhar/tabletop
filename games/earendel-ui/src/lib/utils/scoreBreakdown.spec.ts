import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PieceSource, type PlacePiece } from '@tabletop/earendel'
import { scoreBreakdown } from './scoreBreakdown.js'

const placement = (playerId: string, metadata: PlacePiece['metadata']): GameAction =>
    ({
        id: `${playerId}-${JSON.stringify(metadata)}`,
        gameId: 'g',
        source: ActionSource.User,
        type: ActionType.PlacePiece,
        playerId,
        coords: { q: 0, r: 0 },
        pieceSource: PieceSource.Bag,
        metadata
    }) as GameAction

describe('scoreBreakdown', () => {
    it('splits banked points into complexes and chains, adds planets, and ranks by the total', () => {
        const actions = [
            placement('a', { stationGroupPoints: 4 }),
            placement('a', {
                chains: [{ planets: [], color: 'teal', length: 2, points: 3 }]
            } as never),
            placement('b', { stationGroupPoints: 2 })
        ]
        const rows = scoreBreakdown(
            actions,
            [
                { playerId: 'a', score: 7 },
                { playerId: 'b', score: 5 }
            ],
            { b: 4 }
        )
        expect(rows).toEqual([
            {
                playerId: 'b',
                rank: 1,
                complexes: 2,
                chains: 0,
                other: 3,
                banked: 5,
                planets: 4,
                total: 9
            },
            {
                playerId: 'a',
                rank: 2,
                complexes: 4,
                chains: 3,
                other: 0,
                banked: 7,
                planets: 0,
                total: 7
            }
        ])
    })
})
