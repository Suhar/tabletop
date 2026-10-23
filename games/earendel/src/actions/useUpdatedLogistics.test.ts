import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AttackPiece } from './attackPiece.js'
import { UseUpdatedLogistics } from './useUpdatedLogistics.js'
import { TestGame } from '../util/testHarness.js'
import { bagOf } from '../util/drawBags.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

function openRow(length = 14): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        for (const r of [0, 3]) {
            board.hexes[hexKey(at(q, r))] = { coords: at(q, r), tileId: 't1', kind: HexKind.Open }
        }
    }
    return board
}

// A fighter of the mover's already standing on the board, with an enemy probe beside it.
function scenario() {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    board.hexes[hexKey(at(0, 0))].piece = ship(mover, PieceType.Fighter, PieceLevel.Three)
    board.hexes[hexKey(at(1, 0))].piece = ship(other, PieceType.Probe)
    game.state.board = board
    game.state.technologyDeck = bagOf([])
    game.state.tileSupply = bagOf([])
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.UpdatedLogistics
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, other }
}

describe('Updated Logistics', () => {
    it('wakes a fighter already on the board and lets it fire', () => {
        const { game, mover } = scenario()

        expect(game.validActionsFor(mover)).toContain(ActionType.UseUpdatedLogistics)

        game.run(UseUpdatedLogistics, {
            type: ActionType.UseUpdatedLogistics,
            playerId: mover,
            coords: at(0, 0)
        })

        // The ordinary shot, set up by the ordinary means - so the escort rule, the Railgun and
        // declining all apply without this action knowing about any of them.
        expect(game.state.machineState).toBe(MachineState.Attacking)
        expect(game.state.pendingAttack?.fighterCoords).toEqual(at(0, 0))

        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()

        // And the turn carries on: the ship drawn for it is still owed a hex.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('goes on cooldown, and cannot be used twice in a turn', () => {
        const { game, mover } = scenario()

        game.run(UseUpdatedLogistics, {
            type: ActionType.UseUpdatedLogistics,
            playerId: mover,
            coords: at(0, 0)
        })
        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseUpdatedLogistics)
    })

    it('refuses a fighter with nothing in reach, rather than spending the power', () => {
        const { game, mover } = scenario()
        // Clear the only target, leaving the fighter alone in its row.
        delete game.state.board.hexes[hexKey(at(1, 0))].piece

        expect(() =>
            game.run(UseUpdatedLogistics, {
                type: ActionType.UseUpdatedLogistics,
                playerId: mover,
                coords: at(0, 0)
            })
        ).toThrow()
    })

    it('refuses anything that is not a fighter of the player’s own', () => {
        const { game, mover, other } = scenario()
        game.state.board.hexes[hexKey(at(0, 3))].piece = ship(mover, PieceType.Station)
        game.state.board.hexes[hexKey(at(1, 3))].piece = ship(other, PieceType.Probe)

        // A station cannot be sent to attack, whatever is beside it.
        expect(() =>
            game.run(UseUpdatedLogistics, {
                type: ActionType.UseUpdatedLogistics,
                playerId: mover,
                coords: at(0, 3)
            })
        ).toThrow()
    })

    it('is not offered at all without the technology', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = []

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseUpdatedLogistics)
    })
})
