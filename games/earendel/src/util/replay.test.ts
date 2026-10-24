import { describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import { playRandomGame } from './simulate.js'
import { TestGame } from './testHarness.js'
import { TurnStyle } from '../definition/config.js'
import type { EarendelGameState } from '../model/gameState.js'

// A game must be a pure function of its seeds and its recorded actions: the server replays
// history to rebuild state, Undo walks it backwards, and a reproduction seed is only worth
// anything if it reproduces.

const masterSeed = '0123456789abcdef0123456789abcdef'
const players = 3
const seed = 17

// The state's own id is minted fresh for every new game record, so it is the one field two
// otherwise identical runs are expected to differ in.
const comparable = (state: EarendelGameState) => ({ ...state, id: undefined })

// What an action record says happened, without the wall-clock time it happened at.
const recorded = (action: GameAction) => {
    const { createdAt: _createdAt, ...rest } = action
    return rest
}

const play = () => playRandomGame(players, seed, { start: { masterSeed } })

describe('replaying a seeded game', () => {
    const first = play()

    it('plays a whole game to its end', () => {
        expect(first.finished).toBe(true)
        expect(first.actions.length).toBeGreaterThan(50)
    })

    it('plays out identically from the same seed and master seed', () => {
        const second = play()

        expect(comparable(second.finalState)).toEqual(comparable(first.finalState))
        expect(second.actions.map((action) => [action.type, action.id, action.index])).toEqual(
            first.actions.map((action) => [action.type, action.id, action.index])
        )
        expect(second.actions.map(recorded)).toEqual(first.actions.map(recorded))
    })

    it('differs in its hidden draws under another master seed', () => {
        const other = playRandomGame(players, seed, {
            start: { masterSeed: 'fedcba9876543210fedcba9876543210' }
        })
        expect(comparable(other.finalState)).not.toEqual(comparable(first.finalState))
    })

    it('rebuilds the same final state by replaying the record, and unwinds it with Undo', () => {
        const fresh = new TestGame(
            players,
            seed,
            { turnStyle: TurnStyle.DraftThree },
            { masterSeed }
        )
        const { engine, game } = fresh

        const states: EarendelGameState[] = [fresh.state]
        let state = fresh.state
        for (const action of first.actions) {
            state = engine.applyProcessedAction({ action, state, game })
            states.push(state)
        }
        expect(comparable(state)).toEqual(comparable(first.finalState))

        // Undo each of the last few actions in turn; each step lands exactly on the state that
        // stood before that action was taken.
        const undone = 12
        for (let step = 1; step <= undone; step++) {
            const action = first.actions[first.actions.length - step]
            state = engine.undoProcessedAction({ action, state })
            expect(state).toEqual(states[states.length - 1 - step])
        }

        // And forward again from there reaches the same end.
        for (const action of first.actions.slice(-undone)) {
            state = engine.applyProcessedAction({ action, state, game })
        }
        expect(comparable(state)).toEqual(comparable(first.finalState))
    })
})
