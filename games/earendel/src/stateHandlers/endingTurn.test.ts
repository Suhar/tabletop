import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { UseTacticalFeint } from '../actions/useTacticalFeint.js'
import { EndTurn } from '../actions/endTurn.js'
import { TestGame, stackedBag } from '../util/testHarness.js'

// A turn whose ships are all placed stays open while a technology could still act (rules.md,
// Ending a turn).

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

// Row 0 holds the feint's pieces; row 3, far from it, is where the turn's ship is placed.
function openRows(length = 8): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

// The mover holds a ready Tactical Feint; with an enemy beside one of their ships, it has a use.
function scenario({ enemyBeside }: { enemyBeside: boolean }) {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRows()
    board.hexes[hexKey(at(0, 0))].piece = ship(mover, PieceType.Station)
    board.hexes[hexKey(at(enemyBeside ? 1 : 5, 0))].piece = ship(other, PieceType.Station)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.TacticalFeint
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    const placeLastShip = () =>
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(6, 3),
            pieceSource: PieceSource.Bag
        })

    return { game, mover, other, placeLastShip }
}

describe('ending a turn', () => {
    it('waits once the ships are placed while a technology still has a use', () => {
        const { game, mover, placeLastShip } = scenario({ enemyBeside: true })

        placeLastShip()

        expect(game.state.machineState).toBe(MachineState.EndingTurn)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([
            ActionType.UseTacticalFeint,
            ActionType.EndTurn
        ])
    })

    it('passes to the next player when the turn is ended', () => {
        const { game, mover, other, placeLastShip } = scenario({ enemyBeside: true })

        placeLastShip()
        game.run(EndTurn, { type: ActionType.EndTurn, playerId: mover })

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(other)
    })

    it('ends the turn after the technology is used, once nothing else could act', () => {
        const { game, mover, other, placeLastShip } = scenario({ enemyBeside: true })

        placeLastShip()
        game.run(UseTacticalFeint, {
            type: ActionType.UseTacticalFeint,
            playerId: mover,
            from: at(0, 0),
            to: at(1, 0)
        })

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(other)
    })

    it('does not wait for a technology with nothing to act on', () => {
        const { game, other, placeLastShip } = scenario({ enemyBeside: false })

        placeLastShip()

        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).toBe(other)
    })
})
