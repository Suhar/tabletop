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
import { DrawPieces } from '../actions/drawPieces.js'
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
    // The effect no longer fires when the card is chosen - it fires when the technology is
    // actually CLAIMED, at the top of a turn, having held the planet since the last one. So
    // every test here explores, hands the turn round, and comes back.
    //
    // Note the mover needs a STATION beside the planet to hold it at all: the probe that does
    // the exploring has no power, so a player who only ever sends a probe chooses what a planet
    // holds and then never claims it.
    function scenario() {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), {}],
            [at(0, 1), { ship: ship(mover, PieceType.Station) }],
            [at(5, 5), { ship: ship(mover, PieceType.Station) }],
            [at(6, 5), {}],
            [at(7, 7), {}],
            [at(9, 9), {}]
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
        game.state.tileSupply = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        return { game, mover, other }
    }

    // Explores the planet, lets the other player take a turn elsewhere, then opens the mover's
    // next turn - the moment the claim falls due and the effect becomes pending.
    function exploreAndComeRound(game: TestGame, mover: string, other: string) {
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(9, 9),
            pieceSource: PieceSource.Bag
        })
        return game.run(DrawPieces, { type: ActionType.DrawPieces, playerId: mover })
    }

    it('is not owed at the moment the card is chosen', () => {
        const { game, mover } = scenario()

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })

        // Chosen and housed, but nothing is owed: the planet has to be held to term first.
        expect(game.state.board.hexes[hexKey(at(0, 0))].technology?.id).toBe('mover-tech')
        expect(game.state.pendingTechnology).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
    })

    it('holds the turn open for the move, then returns to the placement', () => {
        const { game, mover, other } = scenario()

        const processed = exploreAndComeRound(game, mover, other)

        // The draw claimed the technology and the effect is waiting on them - before they have
        // placed anything this turn.
        expect(processed[0].type).toBe(ActionType.DrawPieces)
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
        // The turn is not over - the effect interrupted it before the placement, so the ship
        // they drew is still owed a hex.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
    })

    it('scores nothing for the step, because a step is not a placement', () => {
        const { game, mover, other } = scenario()
        // Another station of the mover's, arranged so that stepping the loose one into contact
        // would make a group of three if a step paid like a placement.
        game.state.board.hexes[hexKey(at(7, 5))] = {
            coords: at(7, 5),
            tileId: 't1',
            kind: HexKind.Open,
            piece: ship(mover, PieceType.Station)
        }

        exploreAndComeRound(game, mover, other)
        const before = game.state.players.find((p) => p.playerId === mover)!.score

        game.run(MovePiece, {
            type: ActionType.MovePiece,
            playerId: mover,
            from: at(5, 5),
            to: at(6, 5)
        })

        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(before)
    })

    it('refuses a step that isn’t adjacent', () => {
        const { game, mover, other } = scenario()

        exploreAndComeRound(game, mover, other)

        expect(() =>
            game.run(MovePiece, {
                type: ActionType.MovePiece,
                playerId: mover,
                from: at(5, 5),
                to: at(7, 7)
            })
        ).toThrow()
    })

    it('may be passed up, even with somewhere to step', () => {
        const { game, mover, other } = scenario()

        exploreAndComeRound(game, mover, other)
        expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)

        // A forced step could only hurt - breaking your own blockade, or stepping off a planet
        // you hold - so holding position is always allowed.
        const [held] = game.run(MovePiece, { type: ActionType.MovePiece, playerId: mover })

        expect((held as MovePiece).metadata?.declined).toBe(true)
        expect(game.state.board.hexes[hexKey(at(5, 5))].piece?.playerId).toBe(mover)
        expect(game.state.pendingTechnology).toBeUndefined()
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('fizzles by itself when no friendly piece can step anywhere', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const other = game.state.players.find((p) => p.playerId !== mover)!.playerId

        // The mover's station holds the planet, and there is nowhere at all for anything to
        // step to once the probe lands.
        game.state.board = boardOf([
            [at(0, 0), { planet: PlanetColor.Azure }],
            [at(1, 0), {}],
            [at(0, 1), { ship: ship(mover, PieceType.Station) }],
            [at(9, 9), {}]
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
        game.state.tileSupply = []
        game.stackBags((playerId) => [
            ship(playerId, PieceType.Probe, PieceLevel.Two),
            ship(playerId, PieceType.Station),
            ship(playerId, PieceType.Station)
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag
        })
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: other,
            coords: at(9, 9),
            pieceSource: PieceSource.Bag
        })

        // The claim and the fizzled move both resolve inside the draw that opens the turn -
        // and then the placement that follows fizzles too, since this board has no open hex
        // left to put the drawn ship on. All three are system actions inside one submission.
        const processed = game.run(DrawPieces, {
            type: ActionType.DrawPieces,
            playerId: mover
        })

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.DrawPieces,
            ActionType.MovePiece,
            ActionType.Pass
        ])
        expect((processed[1] as MovePiece).metadata?.noMoveAvailable).toBe(true)
        expect(game.state.pendingTechnology).toBeUndefined()
    })
})
