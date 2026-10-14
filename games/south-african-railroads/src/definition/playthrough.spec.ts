import { describe, expect, it } from 'vitest'
import { GameEngine, GameResult, assert, assertExists, validateGameResult } from '@tabletop/common'
import { RailroadId } from '../components/railroads.js'
import { ACTION_BOXES, ActionBox } from '../model/actionBoxes.js'
import type { SarGameState } from '../model/gameState.js'
import { botAction, createGame } from '../testing/bot.js'
import { SarRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(SarRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function playToEnd(count: number): SarGameState {
    const game = createGame(count)
    let state = engine.startGame(game, { masterSeed }).initialState
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 5000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(SarRuntime.hydrator.hydrateState(state), playerId, step)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    }
    return state
}

describe.each([3, 4, 5, 6])('a %i player game', (count) => {
    it('plays through six dividends to a declared result', () => {
        const finished = playToEnd(count)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect(finished.dividendsPaid).toBe(6)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        expect(finished.railroads.every((railroad) => railroad.treasury === 0)).toBe(true)
        expect(
            finished.railroads.find((r) => r.id === RailroadId.CdFM)?.owners.length
        ).toBeGreaterThan(0)

        const scores = SarRuntime.scoring.finalScores(finished)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
        const again = playToEnd(count)
        expect({ ...again, id: finished.id }).toEqual(finished)
    })

    it('keeps every action box within its capacity', () => {
        const game = createGame(count)
        let state = engine.startGame(game, { masterSeed }).initialState
        for (let step = 0; state.result === undefined; step++) {
            const hydrated = SarRuntime.hydrator.hydrateState(state)
            for (const box of ACTION_BOXES.filter((b) => b !== ActionBox.ConstructTrack)) {
                expect(hydrated.locomotivesIn(box)).toBeLessThanOrEqual(
                    box === ActionBox.PayDividends
                        ? 1
                        : box === ActionBox.DevelopSettlements
                          ? 2
                          : 3
                )
            }
            const [playerId] = state.activePlayerIds
            state = engine.executeCanonicalAction({
                game,
                state,
                action: botAction(hydrated, playerId, step)
            }).updatedState
        }
    })
})
