import { describe, expect, it } from 'vitest'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { TurnStyle } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import { DiscardPiece } from './discardPiece.js'
import { PieceSource, PlacePiece } from './placePiece.js'
import { isUseFactoryOverride, UseFactoryOverride } from './useFactoryOverride.js'
import { legalPlacementsFor } from '../util/placement.js'
import { TestGame } from '../testing/testHarness.js'

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

function scenario(inBag: number) {
    const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
    const mover = game.activePlayerId
    game.giveTechnology(mover, TechnologyEffectKind.FactoryOverride)
    game.stackBags((playerId) =>
        Array.from({ length: inBag }, () => ship(playerId, PieceType.Station))
    )
    return { game, mover }
}

const bagOf = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.bag
const override = (playerId: string) => ({ type: ActionType.UseFactoryOverride as const, playerId })

function placeOne(game: TestGame, playerId: string) {
    const [held] = game.state.heldPieces
    const [coords] = legalPlacementsFor(game.state.board, playerId, held)
    game.run(PlacePiece, {
        type: ActionType.PlacePiece,
        playerId,
        coords,
        pieceSource: PieceSource.Bag,
        pieceId: held.id
    })
}

describe('Factory Override', () => {
    it('waits for the draft, then draws two more ships to be placed with no discard', () => {
        const { game, mover } = scenario(6)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseFactoryOverride)
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })
        expect(bagOf(game, mover).remaining).toBe(3)

        const used = game.run(UseFactoryOverride, override(mover)).find(isUseFactoryOverride)

        expect(used?.metadata?.drawn).toHaveLength(2)
        expect(used?.revealsInfo).toBe(true)
        expect(game.state.heldPieces).toHaveLength(4)
        expect(bagOf(game, mover).remaining).toBe(1)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.DiscardPiece)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseFactoryOverride)

        // All four go down this turn.
        for (let placed = 0; placed < 4; placed++) {
            expect(game.activePlayerId).toBe(mover)
            placeOne(game, mover)
        }
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('may be used once the ships are down, reopening the placement', () => {
        const { game, mover } = scenario(6)
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: game.state.heldPieces[0].id
        })
        placeOne(game, mover)
        placeOne(game, mover)
        expect(game.state.machineState).toBe(MachineState.EndingTurn)

        game.run(UseFactoryOverride, override(mover))

        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.state.heldPieces).toHaveLength(2)
    })

    it('draws what the bag has, and cannot be used on an empty bag', () => {
        const short = scenario(4)
        short.game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: short.mover,
            pieceId: short.game.state.heldPieces[0].id
        })
        const used = short.game
            .run(UseFactoryOverride, override(short.mover))
            .find(isUseFactoryOverride)
        expect(used?.metadata?.drawn).toHaveLength(1)
        expect(bagOf(short.game, short.mover).remaining).toBe(0)

        const empty = scenario(3)
        empty.game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: empty.mover,
            pieceId: empty.game.state.heldPieces[0].id
        })
        expect(empty.game.validActionsFor(empty.mover)).not.toContain(ActionType.UseFactoryOverride)
        expect(() => empty.game.run(UseFactoryOverride, override(empty.mover))).toThrow()
    })
})
