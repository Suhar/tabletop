import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { destinationsFrom, legalMovesFor } from './movement.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { isUseTacticalShift, UseTacticalShift } from '../actions/useTacticalShift.js'
import { EndTurn } from '../actions/endTurn.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'

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
            [at(1, -1), { planet: PlanetColor.Periwinkle }]
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

describe('Tactical Shift', () => {
    // The mover holds the technology with its one use unspent, and has drawn the turn's ship.
    function scenario() {
        const game = new TestGame()
        const mover = game.activePlayerId

        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Periwinkle }],
            [at(1, 0), {}],
            [at(5, 5), { ship: ship(mover, PieceType.Station) }],
            [at(6, 5), {}],
            [at(7, 7), {}],
            [at(9, 9), {}]
        ])
        game.state.technologyDeck = stackedBag([])
        game.state.technologyDiscard = []
        game.state.tileSupply = stackedBag([])
        game.giveTechnology(mover, TechnologyEffectKind.MoveFriendlyPiece)
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        return { game, mover }
    }

    const shift = (playerId: string, from: AxialCoordinates, to: AxialCoordinates) => ({
        type: ActionType.UseTacticalShift as const,
        playerId,
        from,
        to
    })

    const storedShifts = (game: TestGame, playerId: string) =>
        game.state.players
            .find((p) => p.playerId === playerId)!
            .storedEffects.filter((kind) => kind === TechnologyEffectKind.MoveFriendlyPiece).length

    it('is gained as a use to keep, not a move owed at once', () => {
        const { game, mover } = scenario()

        // Nothing interrupts the turn: the ship drawn is waiting for its hex as usual.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.pendingTechnology).toBeUndefined()
        expect(storedShifts(game, mover)).toBe(1)
        expect(game.validActionsFor(mover)).toContain(ActionType.UseTacticalShift)
    })

    it('moves the piece, is spent, and leaves the turn where it was', () => {
        const { game, mover } = scenario()

        game.run(UseTacticalShift, shift(mover, at(5, 5), at(6, 5)))

        expect(game.state.board.hexes[hexKey(at(5, 5))].piece).toBeUndefined()
        expect(game.state.board.hexes[hexKey(at(6, 5))].piece?.playerId).toBe(mover)
        expect(storedShifts(game, mover)).toBe(0)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTacticalShift)
        // The turn is not over: the ship they drew is still owed a hex.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('may be kept for a later turn', () => {
        const { game, mover } = scenario()
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(7, 7),
            pieceSource: PieceSource.Bag
        })
        // Unspent, with a piece that could step: the turn waits to see whether it is used.
        expect(game.state.machineState).toBe(MachineState.EndingTurn)
        game.run(EndTurn, { type: ActionType.EndTurn, playerId: mover })
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(9, 9),
            pieceSource: PieceSource.Bag
        })
        if (game.state.machineState === MachineState.EndingTurn) {
            game.run(EndTurn, { type: ActionType.EndTurn, playerId: other })
        }
        game.run(DrawPieces, { type: ActionType.DrawPieces, playerId: mover })

        expect(storedShifts(game, mover)).toBe(1)
        game.run(UseTacticalShift, shift(mover, at(5, 5), at(6, 5)))
        expect(game.state.board.hexes[hexKey(at(6, 5))].piece?.playerId).toBe(mover)
    })

    it('pays the station group it steps into, because a shifted piece counts as placed', () => {
        const { game, mover } = scenario()
        // Another station of the mover's: stepping the loose one into contact makes a group of
        // two, which pays as a placement there would.
        game.state.board.hexes[hexKey(at(7, 5))] = {
            coords: at(7, 5),
            tileId: 't1',
            kind: HexKind.Open,
            piece: ship(mover, PieceType.Station)
        }
        const before = game.state.players.find((p) => p.playerId === mover)!.score

        const used = game
            .run(UseTacticalShift, shift(mover, at(5, 5), at(6, 5)))
            .find(isUseTacticalShift)

        expect(used?.metadata?.stationGroupPoints).toBe(2)
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(before + 2)
    })

    it('lets a shifted probe survey the planet it lands beside', () => {
        const { game, mover } = scenario()
        Object.assign(
            game.state.board.hexes,
            boardOf([
                [at(5, 8), { ship: ship(mover, PieceType.Probe, PieceLevel.Two) }],
                [at(6, 8), {}],
                [at(7, 8), { planet: PlanetColor.Teal }]
            ]).hexes
        )

        const used = game
            .run(UseTacticalShift, shift(mover, at(5, 8), at(6, 8)))
            .find(isUseTacticalShift)

        expect(used?.metadata).toMatchObject({ probeDestinations: [at(7, 8)] })
        expect(game.state.machineState).toBe(MachineState.Exploring)
        expect(game.state.pendingExploration).toMatchObject({
            playerId: mover,
            probeCoords: at(6, 8),
            candidatePlanets: [at(7, 8)]
        })
    })

    it('refuses a step that isn’t adjacent, a rival’s piece, and a second use', () => {
        const { game, mover } = scenario()
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId
        game.state.board.hexes[hexKey(at(9, 9))].piece = ship(other, PieceType.Station)

        expect(() => game.run(UseTacticalShift, shift(mover, at(5, 5), at(7, 7)))).toThrow()
        expect(() => game.run(UseTacticalShift, shift(mover, at(9, 9), at(8, 9)))).toThrow()

        game.run(UseTacticalShift, shift(mover, at(5, 5), at(6, 5)))
        expect(() => game.run(UseTacticalShift, shift(mover, at(6, 5), at(5, 5)))).toThrow()
    })

    it('is not offered when no friendly piece can step anywhere', () => {
        const { game, mover } = scenario()
        game.state.board = boardOf([
            [at(5, 5), { ship: ship(mover, PieceType.Station) }],
            [at(9, 9), {}]
        ])

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTacticalShift)
        // Kept, for a turn when something can move.
        expect(storedShifts(game, mover)).toBe(1)
    })
})
