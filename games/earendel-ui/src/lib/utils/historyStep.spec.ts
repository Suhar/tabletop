import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { latestHistoryStep } from './historyStep.js'

const action = (id: string, source: ActionSource): GameAction => ({
    id,
    gameId: 'g',
    source,
    type: 'test'
})

describe('latestHistoryStep', () => {
    it('is the last user action and the system actions that followed it', () => {
        const actions = [
            action('1', ActionSource.User),
            action('2', ActionSource.System),
            action('3', ActionSource.User),
            action('4', ActionSource.System),
            action('5', ActionSource.System)
        ]
        expect(latestHistoryStep(actions).map((entry) => entry.id)).toEqual(['3', '4', '5'])
    })

    it('ends on the user action when nothing followed it', () => {
        const actions = [action('1', ActionSource.System), action('2', ActionSource.User)]
        expect(latestHistoryStep(actions).map((entry) => entry.id)).toEqual(['2'])
    })

    it('is empty before any action', () => {
        expect(latestHistoryStep([])).toEqual([])
    })
})
