import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { TurnStyle } from '../definition/config.js'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { MovePiece } from '../actions/movePiece.js'
import { TechnologyTier } from '../model/technology.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { UseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { TestGame } from '../util/testHarness.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

let ids = 0
const station = (playerId: string): Piece => ({
    id: `${playerId}-station-${ids++}`,
    playerId,
    type: PieceType.Station
})

// Plenty of open space and no planets, so nothing but the draft is under test.
function emptyBoard(hexes = 30): EarendelBoard {
    const board: EarendelBoard = { hexes: {} }
    for (let q = 0; q < hexes; q++) {
        board.hexes[hexKey(at(q, 0))] = { coords: at(q, 0), tileId: 't1', kind: HexKind.Open }
        board.hexes[hexKey(at(q, 3))] = { coords: at(q, 3), tileId: 't1', kind: HexKind.Open }
    }
    return board
}

function draftGame(bagSize = 9) {
    const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
    game.state.board = emptyBoard()
    game.state.technologyDeck = []
    game.state.tileSupply = []
    game.stackBags((playerId) => Array.from({ length: bagSize }, () => station(playerId)))
    return game
}

describe('a drafted turn', () => {
    it('opens by drawing three and asking for one to be thrown away', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        expect(game.state.machineState).toBe(MachineState.DraftingPieces)
        expect(game.state.heldPieces).toHaveLength(3)
        expect(game.validActionsFor(mover)).toEqual([ActionType.DiscardPiece])

        const discarded = game.state.heldPieces[1]
        const bagBefore = game.state.players.find((p) => p.playerId === mover)!.bag.length

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: discarded.id
        })

        // Out of the game, not back to the bag: that is what makes a draft cost something.
        expect(game.state.heldPieces).toHaveLength(2)
        expect(game.state.heldPieces.map((piece) => piece.id)).not.toContain(discarded.id)
        expect(game.state.players.find((p) => p.playerId === mover)!.bag).toHaveLength(bagBefore)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('keeps the turn for a second placement, then hands it on', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })

        // Still their turn: one ship left in hand.
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
        expect(game.state.heldPieces).toHaveLength(1)

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(5, 0),
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })

        // Hand empty, so the turn passes - and waits for the next player to draw.
        expect(game.state.heldPieces).toEqual([])
        expect(game.state.machineState).toBe(MachineState.StartOfTurn)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('scores each placement in its own right', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })

        const scoreOf = () => game.state.players.find((p) => p.playerId === mover)!.score

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(0, 0),
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })
        expect(scoreOf()).toBe(1)

        // The second station joins the first, so the two placements build on each other inside
        // one turn - which is the point of the style.
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(1, 0),
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })
        expect(scoreOf()).toBe(3)
    })

    it('insists on being told which ship, while more than one is held', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })

        expect(() =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: at(0, 0),
                pieceSource: PieceSource.Bag
            })
        ).toThrow()
    })

    it('refuses to discard a ship that isn’t in hand, or none at all', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        expect(() =>
            game.run(DiscardPiece, {
                type: ActionType.DiscardPiece,
                playerId: mover,
                pieceId: 'not-mine'
            })
        ).toThrow()
        expect(() =>
            game.run(DiscardPiece, { type: ActionType.DiscardPiece, playerId: mover })
        ).toThrow()
    })

    it('throws nothing away when the bag could not fill the draft', () => {
        // A hand of one is what a nearly-empty bag leaves. There is nothing to choose between,
        // so the discard takes no ship and the turn goes straight on to placing.
        const game = draftGame()
        const mover = game.activePlayerId
        game.state.heldPieces = [game.state.heldPieces[0]]

        const [discard] = game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover
        })

        expect((discard as DiscardPiece).metadata?.nothingToDiscard).toBe(true)
        expect(game.state.heldPieces).toHaveLength(1)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('places all three when a Logistics Upgrade is spent', () => {
        const game = draftGame()
        const mover = game.activePlayerId
        const moverState = () => game.state.players.find((p) => p.playerId === mover)!
        moverState().storedEffects = [TechnologyEffectKind.LogisticsUpgrade]

        expect(game.validActionsFor(mover)).toContain(ActionType.UseLogisticsUpgrade)

        const [used] = game.run(UseLogisticsUpgrade, {
            type: ActionType.UseLogisticsUpgrade,
            playerId: mover
        })

        // Nothing thrown away, and the charge is spent.
        expect((used as UseLogisticsUpgrade).metadata?.piecesKept).toBe(3)
        expect(game.state.heldPieces).toHaveLength(3)
        expect(moverState().storedEffects).toEqual([])
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)

        // Three placements this turn, not two - the turn runs until the hand empties, so this
        // needed no new machinery.
        for (const coords of [at(0, 0), at(1, 0), at(2, 0)]) {
            expect(game.activePlayerId).toBe(mover)
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords,
                pieceSource: PieceSource.Bag,
                pieceId: game.state.heldPieces[0].id
            })
        }

        expect(game.activePlayerId).not.toBe(mover)
    })

    it('is not offered without the charge, and cannot be spent twice', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseLogisticsUpgrade)
        expect(() =>
            game.run(UseLogisticsUpgrade, {
                type: ActionType.UseLogisticsUpgrade,
                playerId: mover
            })
        ).toThrow()

        game.state.players.find((p) => p.playerId === mover)!.storedEffects = [
            TechnologyEffectKind.LogisticsUpgrade
        ]
        game.run(UseLogisticsUpgrade, { type: ActionType.UseLogisticsUpgrade, playerId: mover })

        // One time only.
        expect(() =>
            game.run(UseLogisticsUpgrade, {
                type: ActionType.UseLogisticsUpgrade,
                playerId: mover
            })
        ).toThrow()
    })

    it('keeps the turn through a claimed technology, and discards before it', () => {
        // The reported bug this guards: a technology interrupting a drafted turn must not drop
        // the ships still in hand. The interruption now happens at the TOP of the turn - a
        // planet held since last turn pays as the player draws - which makes the order matter
        // twice over: the discard has to come first, and both kept ships must survive the
        // effect. Resolving the effect straight after the draw would do neither.
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId

        const board = emptyBoard()
        board.hexes[hexKey(at(0, 3))] = {
            coords: at(0, 3),
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Azure,
            explored: true,
            technology: {
                id: 'shift',
                colors: [PlanetColor.Azure],
                tier: TechnologyTier.Standard,
                effect: { kind: TechnologyEffectKind.MoveFriendlyPiece }
            }
        }
        // Holding the planet outright since before this turn, so the claim is due on the draw.
        board.hexes[hexKey(at(0, 4))] = {
            coords: at(0, 4),
            tileId: 't1',
            kind: HexKind.Open,
            piece: { id: `${mover}-holder`, playerId: mover, type: PieceType.Station }
        }
        game.state.board = board
        game.state.tileSupply = []
        game.state.technologyDeck = []
        game.state.technologyDiscard = []
        game.stackBags((playerId) => [
            { id: `${playerId}-probe`, playerId, type: PieceType.Probe, level: PieceLevel.Two },
            { id: `${playerId}-fighter`, playerId, type: PieceType.Fighter, level: PieceLevel.Two },
            { id: `${playerId}-spare`, playerId, type: PieceType.Station }
        ])

        // The draw happens inside this call, and with it the claim - so the technology is owed
        // while there are still three ships in hand.
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: `${mover}-spare`
        })

        // Discarded first, THEN the effect: two ships kept, and the effect waiting on them.
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toEqual([
            'shift'
        ])
        expect(game.state.machineState).toBe(MachineState.ResolvingTechnology)
        expect(game.state.heldPieces.map((piece) => piece.id).sort()).toEqual([
            `${mover}-fighter`,
            `${mover}-probe`
        ])

        game.run(MovePiece, {
            type: ActionType.MovePiece,
            playerId: mover,
            from: at(0, 4),
            to: at(1, 3)
        })

        // Still their turn, both ships still in hand. Ending it here would drop them.
        expect(game.activePlayerId).toBe(mover)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces.map((piece) => piece.id).sort()).toEqual([
            `${mover}-fighter`,
            `${mover}-probe`
        ])

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(5, 0),
            pieceSource: PieceSource.Bag,
            pieceId: `${mover}-probe`
        })
        expect(game.activePlayerId).toBe(mover)

        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: at(6, 0),
            pieceSource: PieceSource.Bag,
            pieceId: `${mover}-fighter`
        })
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('burns the bag half again as fast as the simple turn', () => {
        const draft = draftGame(9)
        const mover = draft.activePlayerId
        const bagOf = (game: TestGame, playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.bag.length

        // Three gone from the bag for two placements.
        expect(bagOf(draft, mover)).toBe(6)

        const simple = new TestGame(2, 1, { turnStyle: TurnStyle.SinglePiece })
        simple.state.board = emptyBoard()
        simple.stackBags((playerId) => Array.from({ length: 9 }, () => station(playerId)))
        expect(bagOf(simple, simple.activePlayerId)).toBe(8)
    })
})
