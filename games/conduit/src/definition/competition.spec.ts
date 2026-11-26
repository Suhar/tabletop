import { describe, expect, it } from 'vitest'
import { assert, GameEngine, Prng, validateGameResult } from '@tabletop/common'
import { ConduitGameStateValidator } from '../model/gameState.js'
import { StartingCash } from '../model/playerState.js'
import { createGame, createTestSession, TestMasterSeed } from '../testing/table.js'
import { playRandomDecision } from '../testing/randomPlay.js'
import { ConduitRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(ConduitRuntime)

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// Conduit has no options, so one configuration covers every setup.
describe.each([3, 4, 5])('Conduit tournaments with %i players', (count) => {
    it('seats players in their assigned order and changes nothing else', () => {
        const game = createGame(count)
        const uninitialized = engine.generateUninitializedState(game, TestMasterSeed)
        const initialize = (playerIds?: string[]) =>
            ConduitRuntime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            // Every player starts with $5 whatever their seat.
            expect(assigned.players.map((player) => player.cash)).toEqual(
                order.map(() => StartingCash)
            )
            expect({ ...assigned, turnManager: normal.turnManager }).toEqual(normal)
            assert(ConduitGameStateValidator.Check(assigned), 'Setup must be canonical')

            const { initialState, startedGame } = engine.startGame(game, {
                masterSeed: TestMasterSeed,
                startingPositions: { playerIds: order }
            })
            expect(startedGame.protectedInformation).toBe(true)
            expect(initialState.turnManager.turnOrder).toEqual(order)
            expect(initialState.machineState).toBe(MachineState.Bidding)
            expect(initialState.activePlayerIds).toEqual([order[0]])
        }
    })

    it('scores every player from an actual finished assigned game', () => {
        const game = createGame(count)
        const order = game.players.map((player) => player.id).reverse()
        const { initialState, startedGame } = engine.startGame(game, {
            masterSeed: TestMasterSeed,
            startingPositions: { playerIds: order }
        })
        const session = createTestSession(startedGame, initialState)
        const random = new Prng({ seed: count, invocations: 0 }).random
        for (let step = 0; session.state.machineState !== MachineState.EndOfGame; step++) {
            assert(step < 2000, 'The game did not finish')
            playRandomDecision(session, random)
        }
        const finished = session.state
        assert(ConduitGameStateValidator.Check(finished), 'Finished state is canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = ConduitRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
        const spectatorView = ConduitRuntime.visibility.state.project(
            finished,
            { kind: 'spectator' },
            { config: {} }
        )
        expect(ConduitRuntime.scoring.finalScores(spectatorView)).toEqual(finalScores)
    })
})
