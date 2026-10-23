import { assert, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isDrawPieces } from '../actions/drawPieces.js'
import { EarendelGameStateValidator } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { TestGame } from '../util/testHarness.js'
import { playRandomGame } from '../util/simulate.js'
import { type EarendelGameConfig, FULL_DECK, TurnStyle } from './config.js'
import { EarendelRuntime } from './runtime.js'

const masterSeed = '0123456789abcdef0123456789abcdef'
const TURN_STYLES = [TurnStyle.DraftThree, TurnStyle.SinglePiece]

function playerIds(count: number): string[] {
    return Array.from({ length: count }, (_, index) => `p${index + 1}`)
}

function rotations(ids: string[]): string[][] {
    return ids.map((_, offset) => [...ids.slice(offset), ...ids.slice(0, offset)])
}

describe.each([2, 3, 4, 5])('Earendel tournaments with %i players', (count) => {
    // A turn opens with its player drawing, so the order of draws is the order of turns. Two full
    // rounds are checked so the order is shown to carry on, not merely to start right.
    it.each(TURN_STYLES)(
        'honours every assigned seat through a finished game (%s)',
        (turnStyle) => {
            for (const order of rotations(playerIds(count).reverse())) {
                const summary = playRandomGame(count, 7, {
                    turnStyle,
                    start: { masterSeed, startingPositions: { playerIds: order } }
                })
                expect(summary.finished).toBe(true)
                expect(summary.finalState.turnManager.turnOrder).toEqual(order)

                const drawers = summary.actions
                    .filter(isDrawPieces)
                    .map((action) => action.playerId)
                expect(drawers.slice(0, count)).toEqual(order)
                expect(drawers.slice(count, 2 * count)).toEqual(order)

                const finished = summary.finalState
                assert(
                    EarendelGameStateValidator.Check(finished),
                    'Finished state must be canonical'
                )
                expect(() => validateGameResult(finished)).not.toThrow()

                const finalScores = EarendelRuntime.scoring!.finalScores(finished)
                expect(finalScores).toEqual(
                    Object.fromEntries(
                        finished.players.map((player) => [player.playerId, player.score])
                    )
                )
                const best = Math.max(...Object.values(finalScores))
                for (const winner of finished.winningPlayerIds) {
                    expect(finalScores[winner]).toBe(best)
                }
            }
        }
    )

    // Both options change setup: the turn style decides the opening state, the deck option what
    // the technology deck holds.
    const configs: EarendelGameConfig[] = TURN_STYLES.flatMap((turnStyle) =>
        [FULL_DECK, TechnologyEffectKind.GrowBoard].map((technologyDeck) => ({
            turnStyle,
            technologyDeck
        }))
    )

    it.each(configs)('changes nothing but turn order for an assigned seat (%o)', (config) => {
        const { game } = new TestGame(count, 7, config)
        const initializer = EarendelRuntime.initializer
        const uninitialized = new TestGame(count, 7, config).engine.generateUninitializedState(
            game,
            masterSeed
        )
        const initialize = (ids?: string[]) =>
            initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    ids ? { playerIds: ids } : undefined
                )
                .dehydrate()

        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(initialize(order)).toEqual(assigned)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(assigned.activePlayerIds).toEqual(
                normal.activePlayerIds.length ? [order[0]] : []
            )

            // Players are stored in turn order; everything about each player is otherwise the
            // same, and so is everything outside the players.
            const byId = (state: typeof normal) =>
                Object.fromEntries(state.players.map((player) => [player.playerId, player]))
            expect(byId(assigned)).toEqual(byId(normal))
            expect({
                ...assigned,
                players: normal.players,
                turnManager: normal.turnManager,
                activePlayerIds: normal.activePlayerIds
            }).toEqual(normal)
            assert(EarendelGameStateValidator.Check(assigned), 'Setup must be canonical')
        }
    })
})
