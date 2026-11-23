import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isUseSpoofedOrders, UseSpoofedOrders } from './useSpoofedOrders.js'
import { spoofablePieces } from '../util/spoofing.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

// A row of open space. The mover's station stands at (3,0) with a rival station beside it at
// (4,0); another rival station stands alone at (9,0). The mover holds Spoofed Orders unspent.
function scenario() {
    const game = new TestGame()
    const mover = game.activePlayerId
    const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId

    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < 12; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
    }
    board.hexes[hexKey(at(3, 0))].piece = ship(mover, PieceType.Station)
    board.hexes[hexKey(at(4, 0))].piece = ship(rival, PieceType.Station)
    board.hexes[hexKey(at(9, 0))].piece = ship(rival, PieceType.Station)
    game.state.board = board
    game.state.technologyDeck = stackedBag([])
    game.state.technologyDiscard = []
    game.state.tileSupply = stackedBag([])
    game.giveTechnology(mover, TechnologyEffectKind.SpoofedOrders)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])

    return { game, mover, rival }
}

const spoof = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
    type: ActionType.UseSpoofedOrders as const,
    playerId,
    from,
    to
})

const stored = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.storedEffects

describe('Spoofed Orders', () => {
    it('is kept until used, and offered while a rival piece stands beside one of yours', () => {
        const { game, mover } = scenario()

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(stored(game, mover)).toEqual([TechnologyEffectKind.SpoofedOrders])
        expect(game.validActionsFor(mover)).toContain(ActionType.UseSpoofedOrders)
        // Only the rival piece beside the mover's own; the one standing alone is out of reach.
        expect(spoofablePieces(game.hydrated.board, mover)).toEqual([at(4, 0)])
    })

    it("steps the rival's piece one hex, is spent, and leaves the turn where it was", () => {
        const { game, mover, rival } = scenario()

        const used = game
            .run(UseSpoofedOrders, spoof(mover, at(4, 0), at(5, 0)))
            .find(isUseSpoofedOrders)

        expect(game.state.board.hexes[hexKey(at(4, 0))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(5, 0))].piece).toMatchObject({
            playerId: rival,
            type: PieceType.Station
        })
        expect(used?.metadata?.piece).toMatchObject({ playerId: rival, type: PieceType.Station })
        expect(stored(game, mover)).toEqual([])
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseSpoofedOrders)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('moves the piece without placing it: nothing scores for its owner', () => {
        const { game, mover, rival } = scenario()
        // Stepping the rival station to (5,0) would join a second rival station at (6,0).
        game.state.board.hexes[hexKey(at(6, 0))].piece = ship(rival, PieceType.Station)
        const before = game.state.players.map((p) => p.score)

        game.run(UseSpoofedOrders, spoof(mover, at(4, 0), at(5, 0)))

        expect(game.state.players.map((p) => p.score)).toEqual(before)
        expect(game.state.pendingExploration).toBeUndefined()
        expect(game.state.pendingAttack).toBeUndefined()
    })

    it('pulls a rival probe off the planet it was surveying', () => {
        const { game, mover, rival } = scenario()
        game.state.board.hexes[hexKey(at(5, 0))] = {
            coords: at(5, 0),
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Teal
        }
        game.state.board.hexes[hexKey(at(4, 0))].piece = {
            ...ship(rival, PieceType.Probe, PieceLevel.Two),
            surveying: at(5, 0)
        }
        game.state.board.hexes[hexKey(at(4, 1))] = {
            coords: at(4, 1),
            tileId: 't1',
            kind: HexKind.Open
        }

        game.run(UseSpoofedOrders, spoof(mover, at(4, 0), at(4, 1)))

        const probe = game.state.board.hexes[hexKey(at(4, 1))].piece
        expect(probe?.playerId).toBe(rival)
        expect(probe).not.toHaveProperty('surveying')
    })

    it("refuses your own piece, a rival's piece not beside yours, and a hex that is not open", () => {
        const { game, mover } = scenario()

        expect(() => game.run(UseSpoofedOrders, spoof(mover, at(3, 0), at(2, 0)))).toThrow()
        expect(() => game.run(UseSpoofedOrders, spoof(mover, at(9, 0), at(10, 0)))).toThrow()
        expect(() => game.run(UseSpoofedOrders, spoof(mover, at(4, 0), at(3, 0)))).toThrow()
        expect(() => game.run(UseSpoofedOrders, spoof(mover, at(4, 0), at(7, 0)))).toThrow()
        expect(stored(game, mover)).toEqual([TechnologyEffectKind.SpoofedOrders])
    })

    it('is not offered, and is kept, while no rival piece stands beside one of yours', () => {
        const { game, mover } = scenario()
        delete game.state.board.hexes[hexKey(at(4, 0))].piece

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseSpoofedOrders)
        expect(stored(game, mover)).toEqual([TechnologyEffectKind.SpoofedOrders])
    })
})
