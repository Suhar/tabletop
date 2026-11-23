import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/earendel'
import { gameEndReason } from './gameEnd.js'

const bags = (remaining: Record<string, number>) =>
    Object.entries(remaining).map(([playerId, left]) => ({ playerId, bag: { remaining: left } }))

const action = (type: ActionType, playerId: string): GameAction => ({
    id: `${type}-${playerId}`,
    gameId: 'g',
    source: ActionSource.User,
    type,
    playerId
})

const nameOf = (playerId: string) => ({ a: 'Tom', b: 'Fiona' })[playerId] ?? playerId

describe('gameEndReason', () => {
    it('names the player whose bag ran out', () => {
        expect(
            gameEndReason(bags({ a: 0, b: 4 }), [action(ActionType.PlacePiece, 'a')], nameOf)
        ).toBe('Tom played the last piece from their bag. There is no final round.')
    })

    it('names the player who could not place', () => {
        expect(gameEndReason(bags({ a: 3, b: 4 }), [action(ActionType.Pass, 'b')], nameOf)).toBe(
            'Fiona drew a ship with nowhere legal to place it, and had no special unit to place instead.'
        )
    })
})
