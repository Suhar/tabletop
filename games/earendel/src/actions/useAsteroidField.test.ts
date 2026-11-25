import { describe, expect, it } from 'vitest'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { EarendelRuntime } from '../definition/runtime.js'
import { StowChoice } from './stowShip.js'
import { isUseAsteroidField, UseAsteroidField } from './useAsteroidField.js'
import { TestGame } from '../testing/testHarness.js'

function scenario() {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId
    game.giveTechnology(mover, TechnologyEffectKind.AsteroidField)
    return { game, mover, rival }
}

const bagOf = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.bag

const use = (playerId: string, choice: StowChoice) => ({
    type: ActionType.UseAsteroidField as const,
    playerId,
    choice
})

describe('Asteroid Field', () => {
    it.each<[StowChoice, Partial<Piece>]>([
        [StowChoice.Probe, { type: PieceType.Probe, level: PieceLevel.Three }],
        [StowChoice.Fighter, { type: PieceType.Fighter, level: PieceLevel.Three }],
        [StowChoice.Station, { type: PieceType.Station }]
    ])('puts three of the chosen %s into the bag and is spent', (choice, ship) => {
        const { game, mover } = scenario()
        // The harness draws the turn's ships before the technology is used.
        game.run(UseAsteroidField, use(mover, choice))
        const before = game.processed.length
        expect(before).toBeGreaterThan(0)

        const bag = bagOf(game, mover)
        const known = new Set(game.state.heldPieces.map((piece) => piece.id))
        const added = bag.items.filter(
            (piece) => piece.type === ship.type && piece.level === ship.level
        )
        expect(bag.remaining).toBe(25 - 1 + 3)
        expect(added.length).toBeGreaterThanOrEqual(3)
        expect(new Set([...bag.items.map((piece) => piece.id), ...known]).size).toBe(
            bag.remaining + known.size
        )
        for (const piece of bag.items) expect(piece.id).toMatch(/^p\d-ship-[0-9a-z]+$/)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([])
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseAsteroidField)
        // The turn carries on where it was.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('may be kept for a later turn, and is not offered without the technology', () => {
        const { game, mover, rival } = scenario()
        game.run(UseAsteroidField, use(mover, StowChoice.Station))
        expect(() => game.run(UseAsteroidField, use(mover, StowChoice.Station))).toThrow()
        expect(() => game.run(UseAsteroidField, use(rival, StowChoice.Station))).toThrow()
    })

    it('keeps the choice from the other players', () => {
        const { game, mover, rival } = scenario()
        const action = game
            .run(UseAsteroidField, use(mover, StowChoice.Fighter))
            .find(isUseAsteroidField)
        expect(action?.choice).toBe(StowChoice.Fighter)

        const actions = EarendelRuntime.visibility!.actions
        const config = game.game.config
        expect(
            actions.project(action!, { kind: 'player', playerId: mover }, { config })
        ).toMatchObject({ choice: StowChoice.Fighter })
        for (const perspective of [
            { kind: 'player', playerId: rival } as const,
            { kind: 'spectator' } as const
        ]) {
            const seen = actions.project(action!, perspective, { config })
            expect(seen).not.toHaveProperty('choice')
            expect(seen).toMatchObject({ type: ActionType.UseAsteroidField, playerId: mover })
            expect(JSON.stringify(seen)).not.toContain('fighter')
        }
    })
})
