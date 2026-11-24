import { describe, expect, it } from 'vitest'
import { PieceLevel, PieceType } from '../model/pieces.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { TurnStyle } from '../definition/config.js'
import { EarendelRuntime } from '../definition/runtime.js'
import { isStowShip, StowChoice, StowShip } from '../actions/stowShip.js'
import { TestGame } from '../testing/testHarness.js'

const opening = (players = 2) =>
    new TestGame(players, 1, { turnStyle: TurnStyle.DraftThree, openingStations: true })

const bagOf = (game: TestGame, playerId: string) =>
    game.state.players.find((player) => player.playerId === playerId)!.bag

describe('the ship stowed at the opening', () => {
    it.each([
        [StowChoice.Probe, { type: PieceType.Probe, level: PieceLevel.Three }],
        [StowChoice.Fighter, { type: PieceType.Fighter, level: PieceLevel.Three }],
        [StowChoice.Station, { type: PieceType.Station }]
    ])('adds a %s to the bag before the station is placed', (choice, ship) => {
        const game = opening()
        const playerId = game.activePlayerId
        const before = bagOf(game, playerId).items

        const processed = game.run(StowShip, { type: ActionType.StowShip, playerId, choice })

        const bag = bagOf(game, playerId)
        expect(bag.remaining).toBe(26)
        const added = bag.items.filter((piece) => !before.some((old) => old.id === piece.id))
        expect(added).toHaveLength(1)
        expect(added[0]).toMatchObject({ playerId, ...ship })
        // Every id is the player and a random token, so the stowed ship's says nothing of it.
        const ids = bag.items.map((piece) => piece.id)
        expect(new Set(ids).size).toBe(26)
        for (const id of ids) expect(id).toMatch(new RegExp(`^${playerId}-ship-[0-9a-z]+$`))
        expect(before.map((piece) => piece.id)).not.toContain(added[0].id)
        expect(processed.filter(isStowShip)).toHaveLength(1)
        expect(game.state.machineState).toBe(MachineState.PlacingOpeningStation)
        expect(game.activePlayerId).toBe(playerId)
    })

    it('cannot be declined: the station is not offered until a ship is stowed', () => {
        const game = opening()
        const playerId = game.activePlayerId
        expect(game.validActionsFor(playerId)).toEqual([ActionType.StowShip])
        expect(() =>
            game.run(StowShip, { type: ActionType.StowShip, playerId, choice: undefined })
        ).toThrow()
        expect(game.state.machineState).toBe(MachineState.StowingShip)
    })

    it('is told to its own player and to nobody else', () => {
        const game = opening(3)
        const playerId = game.activePlayerId
        const rival = game.state.players.find((player) => player.playerId !== playerId)!.playerId
        const [record] = game
            .run(StowShip, { type: ActionType.StowShip, playerId, choice: StowChoice.Fighter })
            .filter(isStowShip)
        const actions = EarendelRuntime.visibility!.actions
        const config = game.game.config

        expect(actions.project(record, { kind: 'player', playerId }, { config })).toMatchObject({
            choice: StowChoice.Fighter
        })
        for (const perspective of [
            { kind: 'player', playerId: rival } as const,
            { kind: 'spectator' } as const
        ]) {
            const seen = actions.project(record, perspective, { config })
            expect(seen).not.toHaveProperty('choice')
            expect(seen).toMatchObject({ type: ActionType.StowShip, playerId })
            expect(JSON.stringify(seen)).not.toContain('fighter')
        }
    })
})
