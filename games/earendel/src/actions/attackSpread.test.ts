import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from './placePiece.js'
import { AttackSpread } from './attackSpread.js'
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

// A hex with all six neighbours, so a spread has something to spread across.
function ring(center: AxialCoordinates): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    const steps = [
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [-1, 1],
        [0, 1]
    ]
    board.hexes[hexKey(center)] = { coords: center, tileId: 't1', kind: HexKind.Open }
    for (const [dq, dr] of steps) {
        const coords = at(center.q + dq, center.r + dr)
        board.hexes[hexKey(coords)] = { coords, tileId: 't1', kind: HexKind.Open }
    }
    // Somewhere well away for anyone who needs a spare hex.
    board.hexes[hexKey(at(9, 9))] = { coords: at(9, 9), tileId: 't1', kind: HexKind.Open }
    return board
}

// The mover is about to drop a level 3 fighter into the middle of three enemy probes.
function scenario() {
    const game = new TestGame()
    const mover = game.activePlayerId
    const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board = ring(at(0, 0))
    board.hexes[hexKey(at(1, 0))].piece = ship(other, PieceType.Probe)
    board.hexes[hexKey(at(0, 1))].piece = ship(other, PieceType.Probe)
    board.hexes[hexKey(at(-1, 1))].piece = ship(other, PieceType.Probe)
    game.state.board = board
    game.state.technologyDeck = bagOf([])
    game.state.tileSupply = bagOf([])
    game.state.players.find((p) => p.playerId === mover)!.cooldownEffects = [
        TechnologyEffectKind.FullTorpedoSpread
    ]
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Fighter, PieceLevel.Three),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    game.run(PlacePiece, {
        type: ActionType.PlacePiece,
        playerId: mover,
        coords: at(0, 0),
        pieceSource: PieceSource.Bag
    })

    return { game, mover, other }
}

describe('Full Torpedo Spread', () => {
    it('hits every named neighbour at once', () => {
        const { game, mover } = scenario()
        expect(game.state.machineState).toBe(MachineState.Attacking)
        expect(game.validActionsFor(mover)).toContain(ActionType.AttackSpread)

        const [spread] = game.run(AttackSpread, {
            type: ActionType.AttackSpread,
            playerId: mover,
            targets: [at(1, 0), at(0, 1), at(-1, 1)]
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(0, 1))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(-1, 1))].piece).toBeUndefined()
        expect((spread as AttackSpread).metadata?.hits).toHaveLength(3)
        expect(game.state.pendingAttack).toBeUndefined()
    })

    it('hits ANY, not only all - a spared neighbour is left standing', () => {
        const { game, mover } = scenario()

        game.run(AttackSpread, {
            type: ActionType.AttackSpread,
            playerId: mover,
            targets: [at(1, 0), at(0, 1)]
        })

        // Deliberately spared. Clearing a piece can hand a planet to a third party or open your
        // own blockade, so "all" is not always what a player wants.
        expect(game.state.board.hexes[hexKey(at(-1, 1))].piece).toBeDefined()
    })

    it('wears fighters down rather than destroying them, exactly as one shot would', () => {
        const { game, mover, other } = scenario()
        // Two level 2 fighters: reachable by a level 3, but only damaged.
        //
        // Placed on OPPOSITE sides of the ring, not side by side. Adjacent fighters of the same
        // player escort each other and become immune to everything - which is exactly what the
        // first draft of this test did, and the spread correctly bounced off both of them.
        game.state.board.hexes[hexKey(at(1, 0))].piece = ship(
            other,
            PieceType.Fighter,
            PieceLevel.Two
        )
        game.state.board.hexes[hexKey(at(-1, 0))].piece = ship(
            other,
            PieceType.Fighter,
            PieceLevel.Two
        )
        // Re-derive the pending targets against the changed board.
        game.state.pendingAttack = {
            playerId: mover,
            fighterCoords: at(0, 0),
            targets: [at(1, 0), at(-1, 0)]
        }

        game.run(AttackSpread, {
            type: ActionType.AttackSpread,
            playerId: mover,
            targets: [at(1, 0), at(-1, 0)]
        })

        expect(game.state.board.hexes[hexKey(at(1, 0))].piece?.level).toBe(PieceLevel.One)
        expect(game.state.board.hexes[hexKey(at(-1, 0))].piece?.level).toBe(PieceLevel.One)
    })

    it('refuses a spread of one - that is an ordinary shot', () => {
        const { game, mover } = scenario()

        expect(() =>
            game.run(AttackSpread, {
                type: ActionType.AttackSpread,
                playerId: mover,
                targets: [at(1, 0)]
            })
        ).toThrow()
    })

    it('refuses a target out of reach, and one named twice', () => {
        const { game, mover } = scenario()

        expect(() =>
            game.run(AttackSpread, {
                type: ActionType.AttackSpread,
                playerId: mover,
                targets: [at(1, 0), at(9, 9)]
            })
        ).toThrow()

        expect(() =>
            game.run(AttackSpread, {
                type: ActionType.AttackSpread,
                playerId: mover,
                targets: [at(1, 0), at(1, 0)]
            })
        ).toThrow()
    })

    it('is not offered with only one piece in reach', () => {
        const { game, mover } = scenario()
        game.state.pendingAttack = {
            playerId: mover,
            fighterCoords: at(0, 0),
            targets: [at(1, 0)]
        }

        expect(game.validActionsFor(mover)).not.toContain(ActionType.AttackSpread)
    })
})
