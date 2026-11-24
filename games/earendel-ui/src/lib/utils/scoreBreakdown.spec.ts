import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PieceSource, PlanetColor, type PlacePiece } from '@tabletop/earendel'
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
    it('splits banked points into complexes and routes, and ranks by the total', () => {
        const actions = [
            placement('a', { stationGroupPoints: 4 }),
            placement('b', {
                routesEstablished: [
                    {
                        id: 'r1',
                        planets: [
                            { q: 0, r: 0 },
                            { q: 3, r: 0 }
                        ],
                        color: PlanetColor.Teal,
                        playerId: 'a',
                        length: 3,
                        points: 3
                    }
                ]
            }),
            placement('b', { stationGroupPoints: 2 })
        ]
        const rows = scoreBreakdown(actions, [
            { playerId: 'a', score: 7 },
            { playerId: 'b', score: 5 }
        ])
        expect(rows).toEqual([
            { playerId: 'a', rank: 1, complexes: 4, routes: 3, bonus: 0, other: 0, total: 7 },
            { playerId: 'b', rank: 2, complexes: 2, routes: 0, bonus: 0, other: 3, total: 5 }
        ])
    })
})
