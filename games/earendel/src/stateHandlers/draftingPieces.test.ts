import { describe, expect, it } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { TurnStyle } from '../definition/config.js'
import { type EarendelBoard, HexKind, hexKey, PlanetColor } from '../model/board.js'
import { type Piece, PieceLevel, PieceType } from '../model/pieces.js'
import { UseTacticalShift } from '../actions/useTacticalShift.js'
import { PieceSource, PlacePiece } from '../actions/placePiece.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { UseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { focusedCardId } from '../model/technologyCards.js'
import { TestGame, stackedBag } from '../testing/testHarness.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'

const at = (q: number, r: number): AxialCoordinates => ({ q, r })
const SHIFT = focusedCardId(TechnologyEffectKind.MoveFriendlyPiece, PlanetColor.Periwinkle, 0)

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
    game.state.technologyDeck = stackedBag([])
    game.state.tileSupply = stackedBag([])
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
        const bagBefore = game.state.players.find((p) => p.playerId === mover)!.bag.remaining

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: discarded.id
        })

        // Out of the game, not back to the bag: that is what makes a draft cost something.
        expect(game.state.heldPieces).toHaveLength(2)
        expect(game.state.heldPieces.map((piece) => piece.id)).not.toContain(discarded.id)
        expect(game.state.players.find((p) => p.playerId === mover)!.bag.remaining).toBe(bagBefore)
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

    it('places all three when a Logistics Upgrade is used', () => {
        const game = draftGame()
        const mover = game.activePlayerId
        game.giveTechnology(mover, TechnologyEffectKind.LogisticsUpgrade)

        expect(game.validActionsFor(mover)).toContain(ActionType.UseLogisticsUpgrade)

        const [used] = game.run(UseLogisticsUpgrade, {
            type: ActionType.UseLogisticsUpgrade,
            playerId: mover
        })

        // Nothing thrown away, and the timer is running.
        expect((used as UseLogisticsUpgrade).metadata?.piecesKept).toBe(3)
        expect(game.state.heldPieces).toHaveLength(3)
        expect(
            canUseCooldownEffect(game.hydrated, mover, TechnologyEffectKind.LogisticsUpgrade)
        ).toBe(false)
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

    it('is not offered without the technology, and rests once used', () => {
        const game = draftGame()
        const mover = game.activePlayerId

        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseLogisticsUpgrade)
        expect(() =>
            game.run(UseLogisticsUpgrade, {
                type: ActionType.UseLogisticsUpgrade,
                playerId: mover
            })
        ).toThrow()

        game.giveTechnology(mover, TechnologyEffectKind.LogisticsUpgrade)
        game.run(UseLogisticsUpgrade, { type: ActionType.UseLogisticsUpgrade, playerId: mover })

        // On its timer now.
        expect(() =>
            game.run(UseLogisticsUpgrade, {
                type: ActionType.UseLogisticsUpgrade,
                playerId: mover
            })
        ).toThrow()
    })

    it('claims a technology on the draw, then asks for the discard, then lets it be used', () => {
        // A technology claimed at the top of the turn is in hand before the discard is chosen,
        // so the player knows what they hold when they throw a ship away. Nothing is owed at
        // once: a one-shot technology waits to be used, and may be used once the draft is done.
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId

        const board = emptyBoard()
        board.hexes[hexKey(at(0, 3))] = {
            coords: at(0, 3),
            tileId: 't1',
            kind: HexKind.Planet,
            color: PlanetColor.Periwinkle,
            explored: true,
            technologyId: SHIFT
        }
        // Surveyed by the mover's probe last turn, and it still leads, so the claim is due on the
        // draw.
        board.hexes[hexKey(at(0, 4))] = {
            coords: at(0, 4),
            tileId: 't1',
            kind: HexKind.Open,
            piece: {
                id: `${mover}-holder`,
                playerId: mover,
                type: PieceType.Probe,
                level: PieceLevel.Two
            }
        }
        // The probe goes into orbit when the claim pays; this gives Tactical Shift a piece to move.
        board.hexes[hexKey(at(5, 3))].piece = station(mover)
        game.state.board = board
        game.state.probeClaims = [{ playerId: mover, coords: at(0, 3), technologyId: SHIFT }]
        game.state.tileSupply = stackedBag([])
        game.state.technologyDeck = stackedBag([])
        game.state.technologyDiscard = []
        game.stackBags((playerId) => [
            { id: `${playerId}-probe`, playerId, type: PieceType.Probe, level: PieceLevel.Two },
            { id: `${playerId}-fighter`, playerId, type: PieceType.Fighter, level: PieceLevel.Two },
            { id: `${playerId}-spare`, playerId, type: PieceType.Station }
        ])

        // No explicit draw: stackBags opens the turn through the engine, so the draw - and with
        // it the claim - has already happened by this point.
        //
        // The technology is claimed and kept, with all three ships still in hand and the
        // discard asked for at once.
        expect(game.state.players.find((p) => p.playerId === mover)!.technologies).toEqual([SHIFT])
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([
            TechnologyEffectKind.MoveFriendlyPiece
        ])
        expect(game.state.machineState).toBe(MachineState.DraftingPieces)
        expect(game.state.heldPieces).toHaveLength(3)
        expect(game.state.draftPending).toBe(true)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseTacticalShift)

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: `${mover}-spare`
        })

        expect(game.state.draftPending).toBe(false)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces.map((piece) => piece.id).sort()).toEqual([
            `${mover}-fighter`,
            `${mover}-probe`
        ])

        // Usable now, before the turn's ships: the held ships survive it.
        game.run(UseTacticalShift, {
            type: ActionType.UseTacticalShift,
            playerId: mover,
            from: at(5, 3),
            to: at(6, 3)
        })
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces).toHaveLength(2)

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
        const bagRemaining = (game: TestGame, playerId: string) =>
            game.state.players.find((p) => p.playerId === playerId)!.bag.remaining

        // Three gone from the bag for two placements.
        expect(bagRemaining(draft, mover)).toBe(6)

        const simple = new TestGame(2, 1, { turnStyle: TurnStyle.SinglePiece })
        simple.state.board = emptyBoard()
        simple.stackBags((playerId) => Array.from({ length: 9 }, () => station(playerId)))
        expect(bagRemaining(simple, simple.activePlayerId)).toBe(8)
    })
})

describe('a special piece in a drafted turn', () => {
    function withSpecial(game: TestGame, playerId: string) {
        const special = { id: `${playerId}-relay`, playerId, type: PieceType.Relay }
        game.state.players.find((p) => p.playerId === playerId)!.specialPieces = [special]
        return special
    }

    it('may not follow a drafted ship: once one is down, the turn finishes with the draft', () => {
        const game = draftGame()
        const mover = game.activePlayerId
        const special = withSpecial(game, mover)

        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })
        game.run(PlacePiece, {
            type: ActionType.PlacePiece,
            playerId: mover,
            coords: { q: 0, r: 0 },
            pieceSource: PieceSource.Bag,
            pieceId: game.state.heldPieces[0].id
        })

        expect(game.state.shipPlacedThisTurn).toBe(true)
        expect(game.validActionsFor(mover)).toContain(ActionType.PlacePiece)
        expect(() =>
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords: { q: 1, r: 0 },
                pieceSource: PieceSource.Special,
                pieceId: special.id
            })
        ).toThrow(/instead of your draw/)
        expect(game.state.players.find((p) => p.playerId === mover)!.specialPieces).toEqual([
            special
        ])
    })

    it('is open again on the player’s next turn', () => {
        const game = draftGame()
        const mover = game.activePlayerId
        withSpecial(game, mover)

        for (const turn of [0, 1]) {
            const playerId = game.activePlayerId
            if (game.state.machineState === MachineState.StartOfTurn) {
                game.run(DrawPieces, { type: ActionType.DrawPieces, playerId })
            }
            game.run(DiscardPiece, {
                type: ActionType.DiscardPiece,
                playerId,
                pieceId: game.state.heldPieces[0].id
            })
            for (const q of [0, 1]) {
                game.run(PlacePiece, {
                    type: ActionType.PlacePiece,
                    playerId,
                    coords: { q: q + turn * 2, r: 0 },
                    pieceSource: PieceSource.Bag,
                    pieceId: game.state.heldPieces[0].id
                })
            }
        }

        expect(game.activePlayerId).toBe(mover)
        expect(game.state.shipPlacedThisTurn).toBeUndefined()
    })
})
