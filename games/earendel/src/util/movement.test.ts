import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind, TechnologyTier } from '../model/technology.js'
import { destinationsFrom, legalMovesFor } from './movement.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { MovePiece } from '../actions/movePiece.js'
import { TestGame } from './testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const ship = (playerId: string, type: PieceType, level?: PieceLevel): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type,
    ...(level ? { level } : {})
})

type Spec = { planet?: PlanetColor; ship?: Piece }

function boardOf(spec: Array<[AxialCoordinates, Spec]>): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (const [coords, { planet, ship: piece }] of spec) {
        board.hexes[hexKey(coords)] = {
            coords,
            tileId: 't1',
            ...(planet
                ? { kind: HexKind.Planet, color: planet }
                : { kind: HexKind.Open, ...(piece ? { piece } : {}) })
        }
    }
    return board
}

describe('destinationsFrom', () => {
    it('offers adjacent empty open space and nothing else', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Station) }],
            [at(1, 0), {}],
            [at(0, 1), { ship: ship('p2', PieceType.Station) }],
            [at(1, -1), { planet: PlanetColor.Azure }]
        ])

        // Only (1,0): the planet can't be stood on and the other hex is occupied.
        expect(destinationsFrom(board, at(0, 0))).toEqual([at(1, 0)])
    })

    it('will not step a probe into an enemy blockade', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p2', PieceType.Station) }],
            [at(1, 0), {}],
            [at(2, 0), { ship: ship('p2', PieceType.Station) }],
            // p1's probe sits beside the closed corridor.
            [at(1, 1), { ship: ship('p1', PieceType.Probe, PieceLevel.Two) }],
            [at(2, 1), {}]
        ])

        const destinations = destinationsFrom(board, at(1, 1))
        expect(destinations).not.toContainEqual(at(1, 0))
        expect(destinations).toContainEqual(at(2, 1))
    })

    it('lets a fighter step into a corridor a probe could not enter', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p2', PieceType.Station) }],
            [at(1, 0), {}],
            [at(2, 0), { ship: ship('p2', PieceType.Station) }],
            [at(1, 1), { ship: ship('p1', PieceType.Fighter, PieceLevel.Two) }]
        ])

        expect(destinationsFrom(board, at(1, 1))).toContainEqual(at(1, 0))
    })

    it('offers nothing from a hex hemmed in on all sides', () => {
        const board = boardOf([[at(0, 0), { ship: ship('p1', PieceType.Station) }]])

        // The board is one hex wide, so there is nowhere adjacent at all.
        expect(destinationsFrom(board, at(0, 0))).toEqual([])
        expect(legalMovesFor(board, 'p1')).toEqual([])
    })

    it('reports moves only for the asking player’s own pieces', () => {
        const board = boardOf([
            [at(0, 0), { ship: ship('p1', PieceType.Station) }],
            [at(1, 0), {}],
            [at(2, 0), { ship: ship('p2', PieceType.Station) }]
        ])

        expect(legalMovesFor(board, 'p1')).toEqual([{ from: at(0, 0), to: at(1, 0) }])
        expect(legalMovesFor(board, 'p2')).toEqual([{ from: at(2, 0), to: at(1, 0) }])
    })
})

describe('an immediate technology', () => {
    // A probe beside one unexplored planet, a deck holding a single matching card that carries
    // the move effect, and a station of the mover's parked with somewhere to step.
    function scenario() {
        const game = new TestGame()
        const mover = game.activePlayerId

        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), {}],
            [at(5, 5), { ship: ship(mover, PieceType.Station) }],
            [at(6, 5), {}],
            [at(7, 7), {}]
        ])
        game.state.technologyDeck = [
            {
                id: 'mover-tech',
                colors: [PlanetColor.Azure],
                tier: TechnologyTier.Standard,
                effect: { kind: TechnologyEffectKind.MoveFriendlyPiece }
            }
        ]
        game.state.technologyDiscard = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station)
        ])

        return { game, mover }
    }

    it('holds the turn open for the move, then ends the turn', () => {
        const { game, mover } = scenario()

        // Placing the probe explores the planet and houses the only matching card, both
        // without asking - so the move is the first thing the player is actually consulted on.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).toEqual([ActionType.MovePiece])
        expect(game.state.pendingTechnology?.technologyId).toBe('mover-tech')

        game.run(MovePiece, {
            type: ActionType.MovePiece,
            playerId: mover,
            from: at(5, 5),
            to: at(6, 5)
        })

        expect(game.state.board.hexes[hexKey(at(5, 5))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(6, 5))].piece?.playerId).toBe(mover)
        expect(game.state.pendingTechnology).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('scores nothing for the step, because a step is not a placement', () => {
        const { game, mover } = scenario()
        // Two more stations of the mover's, arranged so that stepping the loose one into
        // contact would make a group of three if a step paid like a placement.
        game.state.board.hexes[hexKey(at(6, 5))] = {
            coords: at(6, 5),
            tileId: 't1',
            kind: HexKind.Open
        }
        game.state.board.hexes[hexKey(at(7, 5))] = {
            coords: at(7, 5),
            tileId: 't1',
            kind: HexKind.Open,
            piece: ship(mover, PieceType.Station)
        }

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        const before = game.state.players.find((p) => p.playerId === mover)!.score

        game.run(MovePiece, {
            type: ActionType.MovePiece,
            playerId: mover,
            from: at(5, 5),
            to: at(6, 5)
        })

        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(before)
    })

    it('refuses a step that isn’t adjacent, and one onto an occupied hex', () => {
        const { game, mover } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        expect(() =>
            game.run(MovePiece, {
                type: ActionType.MovePiece,
                playerId: mover,
                from: at(5, 5),
                to: at(7, 7)
            })
        ).toThrow()

        // And it cannot be skipped while a move exists.
        expect(() =>
            game.run(MovePiece, { type: ActionType.MovePiece, playerId: mover })
        ).toThrow()
    })

    it('fizzles by itself when no friendly piece can step anywhere', () => {
        const game = new TestGame()
        const mover = game.activePlayerId

        // The probe's hex is the only open space, so once it lands nothing can move.
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), {}]
        ])
        game.state.technologyDeck = [
            {
                id: 'mover-tech',
                colors: [PlanetColor.Azure],
                tier: TechnologyTier.Standard,
                effect: { kind: TechnologyEffectKind.MoveFriendlyPiece }
            }
        ]
        game.state.technologyDiscard = []
        game.stackBags((playerId) => [ship(playerId, PieceType.Probe, PieceLevel.Two)])

        const processed = game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // Placement, planet, technology, and the fizzled move - all resolved in one submission.
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlacePiece,
            ActionType.ChoosePlanet,
            ActionType.ChooseTechnology,
            ActionType.MovePiece
        ])
        expect((processed[3] as MovePiece).metadata?.noMoveAvailable).toBe(true)
        expect(game.state.pendingTechnology).toBeUndefined()
    })
})
