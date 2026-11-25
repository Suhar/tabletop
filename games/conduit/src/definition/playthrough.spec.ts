import { describe, expect, it } from 'vitest'
import { assert, Prng } from '@tabletop/common'
import { MachineState } from './states.js'
import { ConduitGameStateValidator } from '../model/gameState.js'
import { Rounds } from '../model/rules.js'
import { MaxGridSize } from '../model/board.js'
import { startTestGame, type TestSession } from '../testing/table.js'
import { playRandomDecision } from '../testing/randomPlay.js'

function playToEnd(session: TestSession, seed: number) {
    const random = new Prng({ seed, invocations: 0 }).random
    for (let step = 0; session.state.machineState !== MachineState.EndOfGame; step++) {
        assert(step < 2000, 'The game did not finish')
        playRandomDecision(session, random)
        assert(ConduitGameStateValidator.Check(session.state), 'Every state is canonical')
    }
}

describe.each([3, 4, 5])('random games with %i players', (count) => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8])('plays to the end with seed %i', (seed) => {
        const session = startTestGame(count, `${seed}`.padStart(32, '0'))
        playToEnd(session, seed)
        const state = session.hydrated()
        expect(state.round).toBe(Rounds)
        // Round 1 deals one tile per player, later rounds one more than that.
        expect(state.deck.remaining).toBe(60 - Rounds * (count + 1) + 1)
        expect(state.cubesOnBoard()).toBe(0)
        expect(state.winningPlayerIds.length).toBeGreaterThan(0)
        const totalCubes = state.players.reduce(
            (total, player) => total + player.supply + player.reserve,
            0
        )
        expect(totalCubes).toBe(count * 15)
        const span = (values: number[]) => Math.max(...values, 0) - Math.min(...values, 0) + 1
        expect(span(state.board.stations.map((station) => station.cell.col))).toBeLessThanOrEqual(
            MaxGridSize
        )
        expect(span(state.board.stations.map((station) => station.cell.row))).toBeLessThanOrEqual(
            MaxGridSize
        )
    })

    it('is deterministic for a seed', () => {
        const first = startTestGame(count)
        const second = startTestGame(count)
        playToEnd(first, 42)
        playToEnd(second, 42)
        expect({ ...second.state, id: '' }).toEqual({ ...first.state, id: '' })
    })
})
