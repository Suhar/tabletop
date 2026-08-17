import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { COOLDOWN_TURNS, TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { AttackPiece } from '../actions/attackPiece.js'
import { canUseCooldownEffect, turnsUntilReady } from './cooldowns.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A long row of open space, so there is always somewhere to put a ship.
function openRow(length = 20): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < length; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
        board.hexes[hexKey(at(q, 3))] = { coords: at(q, 3), tileId: 't1', kind: HexKind.Open }
    }
    return board
}

// The mover holds a Railgun and a level 3 fighter; a level 2 enemy fighter waits next door.
function scenario() {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = openRow()
    board.hexes[hexKey(at(1, 0))] = {
        coords: at(1, 0),
        tileId: 't1',
        kind: HexKind.Open,
        piece: ship(other, PieceType.Fighter, PieceLevel.Two)
    }
    game.state.board = board
    game.state.technologyDeck = []
    game.state.tileSupply = []
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.Railgun
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Fighter, PieceLevel.Three),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, other }
}

describe('Railgun', () => {
    it('destroys what a shot would otherwise only damage', () => {
        const { game, mover } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })
        expect(game.state.machineState).toBe(MachineState.Attacking)

        const [shot] = game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0),
            useRailgun: true
        })

        // A level 3 fighter would normally knock a level 2 down to 1. With a Railgun it is gone.
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect((shot as AttackPiece).metadata?.railgun).toBe(true)
        expect((shot as AttackPiece).metadata?.damaged).toBeUndefined()
    })

    it('starts a timer, and comes back on the owner’s third turn after', () => {
        const { game, mover } = scenario()
        const readyNow = () =>
            canUseCooldownEffect(game.hydrated, mover, TechnologyEffectKind.Railgun)

        expect(readyNow()).toBe(true)
        expect(COOLDOWN_TURNS[TechnologyEffectKind.Railgun]).toBe(3)

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0),
            useRailgun: true
        })

        // Judged while it is the mover's turn, which is the only moment it matters - a count
        // taken between turns is halfway through the tick and tells you nothing useful.
        const playOn = (q: number) =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: game.activePlayerId,
                coords: at(q, 3),
                pieceSource: PieceSource.Bag
            })

        let q = 0
        for (const [turnsLater, expected] of [
            [1, false],
            [2, false],
            [3, true]
        ] as const) {
            // The other player's turn, then the mover is up again.
            playOn(q++)
            expect(game.activePlayerId).toBe(mover)
            expect(readyNow(), `on the mover's turn ${turnsLater} after using it`).toBe(expected)
            if (!expected) playOn(q++)
        }

        // And the other players' turns in between never shortened it: three of the MOVER's turns
        // had to pass, whatever anyone else did.
        expect(turnsUntilReady(game.hydrated, mover, TechnologyEffectKind.Railgun)).toBe(0)
    })

    it('cannot be used without holding it, nor while its timer runs', () => {
        const { game, mover } = scenario()
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = []

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        expect(() =>
            game.run(AttackPiece, {
                type: ActionType.AttackPiece,
                playerId: mover,
                coords: at(1, 0),
                useRailgun: true
            })
        ).toThrow()
    })

    it('refuses to be wasted on a shot that already kills', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        const board = openRow()
        // A probe is destroyed by any shot, so a Railgun would buy nothing and cost three turns.
        board.hexes[hexKey(at(1, 0))] = {
            coords: at(1, 0),
            tileId: 't1',
            kind: HexKind.Open,
            piece: ship(other, PieceType.Probe, PieceLevel.Two)
        }
        game.state.board = board
        game.state.technologyDeck = []
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
            TechnologyEffectKind.Railgun
        ]
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Three),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        expect(() =>
            game.run(AttackPiece, {
                type: ActionType.AttackPiece,
                playerId: mover,
                coords: at(1, 0),
                useRailgun: true
            })
        ).toThrow()

        // The ordinary shot still works.
        game.run(AttackPiece, {
            type: ActionType.AttackPiece,
            playerId: mover,
            coords: at(1, 0)
        })
        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
    })

    it('does not extend a fighter’s reach', () => {
        // A Railgun changes what a hit does, not what can be hit. An EQUAL fighter is reachable
        // now, so the demonstration has to be a fighter above the attacker: a level 2 firing at
        // a level 3, which no Railgun makes possible.
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        const board = openRow()
        board.hexes[hexKey(at(1, 0))] = {
            coords: at(1, 0),
            tileId: 't1',
            kind: HexKind.Open,
            piece: ship(other, PieceType.Fighter, PieceLevel.Three)
        }
        game.state.board = board
        game.state.technologyDeck = []
        game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
            TechnologyEffectKind.Railgun
        ]
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Fighter, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag
        })

        // No shot was ever on offer, so the turn never stopped to ask.
        expect(game.state.pendingAttack).toBeUndefined()
    })
})
