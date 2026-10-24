import { describe, expect, it } from 'vitest'
import { Visibility, type GameAction } from '@tabletop/common'
import { EarendelRuntime } from './runtime.js'
import { EarendelActionSchemas } from './actionSchemas.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { TurnStyle } from './config.js'
import {
    EarendelGameStateValidator,
    EarendelProjectedStateValidator,
    type EarendelGameState
} from '../model/gameState.js'
import { TestGame } from '../util/testHarness.js'
import { playRandomGame } from '../util/simulate.js'
import { isDrawPieces } from '../actions/drawPieces.js'
import { isChoosePlanet } from '../actions/choosePlanet.js'

const masterSeed = '00112233445566778899aabbccddeeff'
const players = 3
const seed = 29
const visibility = EarendelRuntime.visibility!
const spectator = { kind: 'spectator' } as const

// A seeded game played to the end at random, then replayed to recover the canonical state after
// every action - a supply of real positions from the opening to the last move.
const played = playRandomGame(players, seed, { start: { masterSeed } })
const table = new TestGame(players, seed, { turnStyle: TurnStyle.DraftThree }, { masterSeed })
const { game, engine } = table
const states: EarendelGameState[] = [table.state]
for (const action of played.actions) {
    states.push(engine.applyProcessedAction({ action, state: states.at(-1)!, game }))
}

const perspectives: Visibility.Perspective[] = [
    spectator,
    ...game.players.map((player) => ({ kind: 'player', playerId: player.id }) as const)
]

const project = (state: EarendelGameState, perspective: Visibility.Perspective) =>
    visibility.state.project(state, perspective, { config: game.config })

// The positions checked: the opening, the first turn's placement, the turn after a technology
// tile was drawn (if the game drew one), the middle of the game and its end.
const firstPlacing = states.findIndex((state) => state.machineState === MachineState.PlacingPiece)
const withTile = states.findIndex((state) => state.pendingTile !== undefined)
const samples: Array<[string, EarendelGameState]> = [
    ['the opening', states[0]],
    ['the first placement', states[firstPlacing]],
    ['the middle of the game', states[Math.floor(states.length / 2)]],
    ['the end', states.at(-1)!],
    ...(withTile >= 0 ? [['a drawn tile', states[withTile]] as [string, EarendelGameState]] : [])
]

describe('Earendel visibility', () => {
    it('plays a real game whose positions are canonical', () => {
        expect(played.finished).toBe(true)
        expect(firstPlacing).toBeGreaterThan(0)
        for (const [, state] of samples) expect(EarendelGameStateValidator.Check(state)).toBe(true)
        expect(states[0].protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        expect(states[0].masterSeed).toBe(masterSeed)
    })

    describe.each(samples)('at %s', (_label, state) => {
        it.each(perspectives)('hides every drawn-blind pile from %o', (perspective) => {
            const view = project(state, perspective)

            // Counts stay public; contents and order do not - not even one's own bag.
            view.players.forEach((player, index) => {
                expect(player.bag).toEqual({
                    items: [],
                    remaining: state.players[index].bag.remaining
                })
                expect(state.players[index].bag.items).toHaveLength(
                    state.players[index].bag.remaining
                )
            })
            expect(view.technologyDeck).toEqual({
                items: [],
                remaining: state.technologyDeck.remaining
            })
            expect(view.tileSupply).toEqual({ items: [], remaining: state.tileSupply.remaining })
            expect(state.technologyDeck.items).toHaveLength(state.technologyDeck.remaining)
            expect(state.tileSupply.items).toHaveLength(state.tileSupply.remaining)

            // The random state that shuffles them is neutralised, and the seed is gone.
            expect(view.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(view).not.toHaveProperty('masterSeed')

            // Everything on the table stays as it is.
            expect(view.heldPieces).toEqual(state.heldPieces)
            expect(view.technologyDiscard).toEqual(state.technologyDiscard)
            expect(view.board).toEqual(state.board)
            expect(view.probeClaims).toEqual(state.probeClaims)
            expect(view.pendingTile).toEqual(state.pendingTile)
            expect(view.prng).toEqual(state.prng)
            expect(view.machineState).toBe(state.machineState)
            expect(view.players.map((player) => player.score)).toEqual(
                state.players.map((player) => player.score)
            )
            expect(view.players.map((player) => player.technologies)).toEqual(
                state.players.map((player) => player.technologies)
            )

            expect(EarendelProjectedStateValidator.Check(view)).toBe(true)
            expect(EarendelRuntime.hydrator.hydrateState(view).dehydrate()).toEqual(view)
            // Nothing hidden leaks anywhere else in the view.
            const encoded = JSON.stringify(view)
            for (const tile of state.tileSupply.items) expect(encoded).not.toContain(tile.id)
            for (const technologyId of state.technologyDeck.items) {
                expect(encoded).not.toContain(`"${technologyId}"`)
            }
        })

        it('offers each player the same actions from their own view as from the full state', () => {
            for (const player of game.players) {
                const perspective = { kind: 'player', playerId: player.id } as const
                const canonical = engine.getValidActionTypesForPlayer(game, state, player.id)
                const projected = engine.getValidActionTypesForPlayer(
                    game,
                    project(state, perspective),
                    player.id,
                    { perspective }
                )
                expect(projected).toEqual(canonical)
            }
        })
    })

    it('a pending tile is public once drawn', () => {
        // Not every seed draws one; this one is chosen so that it does.
        expect(withTile).toBeGreaterThan(0)
        const state = states[withTile]
        expect(project(state, spectator).pendingTile).toEqual(state.pendingTile)
    })

    it('discovers legal actions from a projection at the start and middle of a turn', () => {
        const opening = states[0]
        const active = opening.activePlayerIds[0]
        const perspective = { kind: 'player', playerId: active } as const
        expect(
            engine.getValidActionTypesForPlayer(game, project(opening, perspective), active, {
                perspective
            })
        ).toContain(ActionType.DrawPieces)

        const placing = states[firstPlacing]
        const placer = placing.activePlayerIds[0]
        const placerView = { kind: 'player', playerId: placer } as const
        expect(
            engine.getValidActionTypesForPlayer(game, project(placing, placerView), placer, {
                perspective: placerView
            })
        ).toContain(ActionType.PlacePiece)
    })

    describe('action records', () => {
        const projectAll = (perspective: Visibility.Perspective) =>
            played.actions.map((action) =>
                visibility.actions.project(action, perspective, { config: game.config })
            )

        it('registers a schema for every action type', () => {
            expect(Object.keys(EarendelActionSchemas).sort()).toEqual(
                Object.values(ActionType).sort()
            )
        })

        it.each(perspectives)('keep their public results for %o', (perspective) => {
            const projected = projectAll(perspective)
            expect(projected.some(Visibility.isRedactedAction)).toBe(false)

            const draws = projected.filter(isDrawPieces)
            const canonicalDraws = played.actions.filter(isDrawPieces)
            expect(draws.length).toBeGreaterThan(0)
            draws.forEach((draw, index) => {
                expect(draw.metadata?.drawn).toEqual(canonicalDraws[index].metadata?.drawn)
            })
            expect(draws.some((draw) => (draw.metadata?.drawn ?? []).length > 0)).toBe(true)

            const explorations = projected.filter(isChoosePlanet)
            const canonicalExplorations = played.actions.filter(isChoosePlanet)
            expect(explorations.length).toBeGreaterThan(0)
            explorations.forEach((choice, index) => {
                expect(choice.metadata).toEqual(canonicalExplorations[index].metadata)
            })
        })

        it('carry nothing from the hidden piles', () => {
            const end = states.at(-1)!
            const projected: GameAction[] = projectAll(spectator)
            // The canonical undo patches hold whole piles, so they never leave the server.
            for (const action of projected) {
                expect(action).not.toHaveProperty('undoPatch')
                expect(action).not.toHaveProperty('forwardPatch')
            }
            const encoded = JSON.stringify(projected)

            // A ship drawn face-up and later returned to its bag was seen by everyone; one that
            // has stayed in the bag all game must not be named by any record.
            const drawn = new Set(
                played.actions
                    .filter(isDrawPieces)
                    .flatMap((draw) => draw.metadata?.drawn ?? [])
                    .map((piece) => piece.id)
            )
            const unseen = end.players
                .flatMap((player) => player.bag.items)
                .filter((piece) => !drawn.has(piece.id))
            expect(unseen.length).toBeGreaterThan(0)
            for (const piece of unseen) expect(encoded).not.toContain(`"${piece.id}"`)
            for (const tile of end.tileSupply.items) expect(encoded).not.toContain(`"${tile.id}"`)
        })
    })
})
