import { describe, expect, it } from 'vitest'
import { assert, MachineContext, Prng, validateGameResult, type Visibility } from '@tabletop/common'
import {
    ConduitGameStateValidator,
    type ConduitProjectedState,
    HydratedConduitGameState
} from '../model/gameState.js'
import { createGame, startTestGame, type TestSession } from '../testing/table.js'
import { playRandomDecision } from '../testing/randomPlay.js'
import { ConduitRuntime } from './runtime.js'
import { MachineState } from './states.js'

function perspectivesFor(state: ConduitProjectedState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function playDecisions(session: TestSession, count: number, seed = 7) {
    const random = new Prng({ seed, invocations: 0 }).random
    for (
        let step = 0;
        step < count && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        playRandomDecision(session, random)
    }
}

function stages(count: number): ConduitProjectedState[] {
    const session = startTestGame(count)
    const atSetup = structuredClone(session.state)
    playDecisions(session, 40)
    const midGame = structuredClone(session.state)
    playDecisions(session, 2000)
    expect(session.state.machineState).toBe(MachineState.EndOfGame)
    return [atSetup, midGame, session.state]
}

describe.each([3, 4, 5])('what each Perspective sees with %i players', (count) => {
    it('hides the order of the stack, shows everything else, and hydrates', () => {
        for (const state of stages(count)) {
            assert(ConduitGameStateValidator.Check(state), 'Projection starts from canonical state')
            for (const perspective of perspectivesFor(state)) {
                const view = ConduitRuntime.visibility.state.project(state, perspective, {
                    config: {}
                })
                expect(view).not.toHaveProperty('masterSeed')
                expect(view.deck).toEqual({ items: [], remaining: state.deck.remaining })
                expect({
                    ...view,
                    deck: state.deck,
                    protectedPrng: state.protectedPrng
                }).toEqual({ ...state, masterSeed: undefined })

                // The projected state hydrates, and the rules read it as they read the real one.
                const hydrated = new HydratedConduitGameState(structuredClone(view))
                const real = new HydratedConduitGameState(structuredClone(state))
                expect(hydrated.deck.items).toEqual([])
                expect(hydrated.market).toEqual(real.market)
                expect(hydrated.currentOffer()).toEqual(real.currentOffer())
                expect(hydrated.pendingPlacement()).toEqual(real.pendingPlacement())
                expect(hydrated.leadingPlayerIds()).toEqual(real.leadingPlayerIds())
            }
        }
    })

    it('fills the stack for exploration with exactly the unseen tiles', () => {
        const [, midGame] = stages(count)
        const view = ConduitRuntime.visibility.state.project(
            midGame,
            { kind: 'player', playerId: 'p0' },
            { config: {} }
        )
        const explored = ConduitRuntime.exploration.createFromProjectedState({
            game: createGame(count),
            state: view,
            actions: [],
            perspective: { kind: 'player', playerId: 'p0' },
            random: new Prng({ seed: 3, invocations: 0 }).random
        })
        assert(ConduitGameStateValidator.Check(explored), 'Exploration is canonical')
        expect(explored.deck.items.toSorted((a, b) => a - b)).toEqual(
            midGame.deck.items.toSorted((a, b) => a - b)
        )
    })
})

describe('the stack', () => {
    it('holds every tile left after setup, hidden from every player', () => {
        const state = startTestGame(4).state
        expect(state.deck.remaining).toBe(60 - 4)
        const view = ConduitRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: 'p0' },
            { config: {} }
        )
        expect(view.deck).toEqual({ items: [], remaining: 56 })
    })
})

describe('the end-of-game result', () => {
    it('is a draw when cash and supply tie', () => {
        const session = startTestGame(3)
        const state = session.hydrated()
        for (const seat of state.players) {
            seat.cash = 9
            seat.supply = 3
        }
        state.machineState = MachineState.EndOfGame
        ConduitRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: session.game.config })
        )
        expect(state.winningPlayerIds).toEqual(['p0', 'p1', 'p2'])
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })
})
