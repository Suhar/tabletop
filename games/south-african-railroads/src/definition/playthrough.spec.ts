import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    assert,
    assertExists,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { RailroadId } from '../components/railroads.js'
import { ACTION_BOXES, ActionBox } from '../model/actionBoxes.js'
import type { HydratedSarGameState, SarGameState } from '../model/gameState.js'
import { homeLinks } from '../model/track.js'
import { freeBuildHome } from '../model/freeBuild.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { SarRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(SarRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number) {
    return SarRuntime.initializer.initializeGame(
        {
            id: 'sar-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

export function botAction(state: HydratedSarGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const handler = SarRuntime.stateHandlers[state.machineState]
    const valid = handler.validActionsForPlayer(
        playerId,
        new MachineContext({ gameConfig: {}, gameState: state })
    )
    switch (state.machineState) {
        case MachineState.Bidding: {
            const amount = state.smallestBid()
            const cash = state.getPlayerState(playerId).cash
            if (valid.includes(ActionType.PlaceBid) && amount <= Math.min(cash, 6 + (step % 9))) {
                return act({ ...base, type: ActionType.PlaceBid, amount })
            }
            return act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.FreeBuild: {
            const due = state.freeBuild
            assertExists(due, 'A free build is due')
            const [linkId] = homeLinks(state, freeBuildHome(due.railroadId))
            return act({
                ...base,
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
        case MachineState.ChoosingAction: {
            const boxes = state.availableBoxes(playerId)
            const box = boxes[step % boxes.length] ?? ActionBox.ConstructTrack
            return act({ ...base, type: ActionType.ChooseAction, box })
        }
        case MachineState.ConstructingTrack:
        case MachineState.DelegatedBuild: {
            if (valid.includes(ActionType.DelegateBuild)) {
                const [railroadId] = state.buildableRailroads()
                return act({
                    ...base,
                    type: ActionType.DelegateBuild,
                    railroadId,
                    builderId: state.controllers(railroadId)[0]
                })
            }
            const [railroadId] = state.builderRailroads(playerId)
            const connection = state.connectionBuilds(railroadId)[0]
            if (connection && step % 2 === 0) {
                return act({
                    ...base,
                    type: ActionType.BuildConnection,
                    railroadId,
                    connectionId: connection.id
                })
            }
            const double = state.doubleBuilds(railroadId)[0]
            if (double && step % 3 === 0) {
                return act({
                    ...base,
                    type: ActionType.BuildTrack,
                    railroadId,
                    linkIds: [...double]
                })
            }
            const singles = state.singleBuilds(railroadId)
            return act({
                ...base,
                type: ActionType.BuildTrack,
                railroadId,
                linkIds: [singles[step % singles.length]]
            })
        }
        case MachineState.DevelopingSettlements: {
            if (valid.includes(ActionType.FinishDevelopment) && step % 2 === 0) {
                return act({ ...base, type: ActionType.FinishDevelopment })
            }
            const options = state.affordableDevelopments(playerId)
            return act({
                ...base,
                type: ActionType.Develop,
                settlementId: options[step % options.length]
            })
        }
        case MachineState.OfferingStock: {
            const [railroadId] = state.unsoldOffers()
            if (railroadId) {
                return act({ ...base, type: ActionType.OfferShare, railroadId, ownShare: false })
            }
            return act({ ...base, type: ActionType.DeclineOffer })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}

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
