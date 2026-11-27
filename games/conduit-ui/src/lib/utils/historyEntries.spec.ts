import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/conduit'
import { historyItems } from './historyEntries.js'

let next = 0
function action(type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    return { id: `a${next++}`, gameId: 'g', source: ActionSource.User, type, ...fields }
}

const name = (playerId: string) => playerId.toUpperCase()

describe('history entries', () => {
    it('groups bidding, each tile, revenue and rounds', () => {
        const items = historyItems(
            [
                action(ActionType.PlaceBid, { playerId: 'p0', spot: 1 }),
                action(ActionType.PlaceBid, { playerId: 'p1', spot: 2 }),
                action(ActionType.PassTile, {
                    playerId: 'p0',
                    metadata: { tileId: 3, price: 2, cubes: 1 }
                }),
                action(ActionType.BuyTile, {
                    playerId: 'p1',
                    metadata: { tileId: 3, price: 1, payments: [] }
                }),
                action(ActionType.PlaceTile, {
                    playerId: 'p1',
                    cell: { col: 1, row: -1 },
                    rotation: 0,
                    extraCubes: 2,
                    metadata: { tileId: 3, faceUp: true }
                }),
                action(ActionType.PayRevenue, {
                    source: ActionSource.System,
                    metadata: {
                        revenues: [{ playerId: 'p1', tileId: 3, route: [], amount: 3 }]
                    }
                }),
                action(ActionType.LoseInfrastructure, {
                    metadata: { flippedTileIds: [], refills: [], roundEnded: true }
                }),
                action(ActionType.FillMarket, {
                    revealsInfo: true,
                    metadata: { round: 2, tileIds: [17, 33, 49, 1] }
                })
            ],
            name
        )
        expect(items.map((item) => (item.kind === 'divider' ? item.label : item.title))).toEqual([
            'Round 1',
            'Bidding',
            'The A tile',
            'Revenue',
            'Infrastructure loss',
            'Round 2',
            'New market'
        ])
        const tile = items[2]
        expect(tile.kind === 'entry' && tile.lines).toEqual([
            'P0 passed on the A tile, taking $1 and 1 cube back',
            'P1 bought the A tile for $1',
            'P1 placed it with 3 cubes'
        ])
    })

    it('lists the bonuses a route paid other players', () => {
        const items = historyItems(
            [
                action(ActionType.PayRevenue, {
                    source: ActionSource.System,
                    metadata: {
                        revenues: [
                            {
                                playerId: 'p1',
                                tileId: 3,
                                route: [],
                                amount: 4,
                                bonuses: [
                                    { playerId: 'p0', amount: 1 },
                                    { playerId: 'p2', amount: 1 },
                                    { playerId: 'p0', amount: 1 }
                                ]
                            }
                        ]
                    }
                })
            ],
            name
        )
        const revenue = items[1]
        expect(revenue.kind === 'entry' && revenue.lines).toEqual([
            "P1's A tile: $4, bonuses P0 $2, P2 $1"
        ])
    })
})
