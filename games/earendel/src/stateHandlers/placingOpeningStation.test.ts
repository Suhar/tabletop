import { describe, expect, it } from 'vitest'
import { PieceType } from '../model/pieces.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { TurnStyle } from '../definition/config.js'
import { isPlacePiece, PieceSource, PlacePiece } from '../actions/placePiece.js'
import { StowChoice, StowShip } from '../actions/stowShip.js'
import { TestGame } from '../testing/testHarness.js'
import { legalPlacementsFor } from '../util/placement.js'
import { openingStationId } from './placingOpeningStation.js'
import { HydratedEarendelGameState } from '../model/gameState.js'

function placeOpening(game: TestGame, playerId: string, at = 0) {
    if (game.state.machineState === MachineState.StowingShip) {
        game.run(StowShip, { type: ActionType.StowShip, playerId, choice: StowChoice.Station })
    }
    const station = game.state.heldPieces[0]
    const coords = legalPlacementsFor(game.state.board, playerId, station)[at]
    return game.run(PlacePiece, {
        type: ActionType.PlacePiece,
        playerId,
        coords,
        pieceSource: PieceSource.Bag,
        pieceId: station.id
    })
}

describe('the opening stations', () => {
    it('are placed before the first turn, last player first, free and unscored', () => {
        const game = new TestGame(3, 1, { turnStyle: TurnStyle.DraftThree, openingStations: true })
        const order = game.state.turnManager.turnOrder
        expect(game.state.machineState).toBe(MachineState.StowingShip)
        expect(game.hydrated.turnManager.currentTurn()).toBeUndefined()

        for (const playerId of [...order].reverse()) {
            expect(game.activePlayerId).toBe(playerId)
            expect(game.validActionsFor(playerId)).toEqual([ActionType.StowShip])
            game.run(StowShip, { type: ActionType.StowShip, playerId, choice: StowChoice.Station })
            expect(game.activePlayerId).toBe(playerId)
            expect(game.validActionsFor(playerId)).toEqual([ActionType.PlacePiece])
            expect(game.state.heldPieces).toEqual([
                {
                    id: openingStationId(playerId),
                    playerId,
                    type: PieceType.Station,
                    founding: true
                }
            ])
            const placed = placeOpening(game, playerId).find(isPlacePiece)
            expect(placed?.metadata).toMatchObject({ pieceType: PieceType.Station, founding: true })
            expect(placed?.metadata).not.toHaveProperty('stationGroupPoints')
        }

        const state = new HydratedEarendelGameState(game.state)
        for (const player of state.players) {
            expect(player.score).toBe(0)
            expect(player.bag.remaining).toBe(26)
            expect(player.bag.items.some((piece) => piece.founding)).toBe(false)
        }
        const founding = Object.values(state.board.hexes).filter((hex) => hex.piece?.founding)
        expect(founding.map((hex) => hex.piece?.playerId).sort()).toEqual([...order].sort())
        expect(founding.every((hex) => hex.piece?.hub !== true)).toBe(true)

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(order[0])
        expect(game.state.heldPieces).toEqual([])
    })

    it('counts as a station for the complex a later station joins', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.SinglePiece, openingStations: true })
        const order = game.state.turnManager.turnOrder
        placeOpening(game, order[1])
        placeOpening(game, order[0])
        const opening = Object.values(game.state.board.hexes).find(
            (hex) => hex.piece?.founding && hex.piece.playerId === order[0]
        )!

        game.stackBags((playerId) => [
            { id: `${playerId}-station-1`, playerId, type: PieceType.Station }
        ])
        const beside = legalPlacementsFor(
            game.state.board,
            order[0],
            game.state.heldPieces[0]
        ).find(
            (coords) =>
                Math.max(
                    Math.abs(coords.q - opening.coords.q),
                    Math.abs(coords.r - opening.coords.r),
                    Math.abs(coords.q + coords.r - opening.coords.q - opening.coords.r)
                ) === 1
        )!
        const placed = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: order[0],
            coords: beside,
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })
        expect(placed.find(isPlacePiece)?.metadata?.stationGroupPoints).toBe(2)
    })

    it('are skipped when the option is off', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(game.state.turnManager.turnOrder[0])
    })
})
