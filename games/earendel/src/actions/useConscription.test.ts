import { describe, expect, it } from 'vitest'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { TurnStyle } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import { DiscardPiece } from './discardPiece.js'
import { EndTurn } from './endTurn.js'
import { PieceSource, PlacePiece } from './placePiece.js'
import { legalPlacementsFor } from '../util/placement.js'
import { isUseConscription, UseConscription } from './useConscription.js'
import { turnsUntilReady } from '../util/cooldowns.js'
import { TestGame } from '../testing/testHarness.js'

let ids = 0
const ship = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

function scenario() {
    const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
    const mover = game.activePlayerId
    game.giveTechnology(mover, TechnologyEffectKind.Conscription)
    game.stackBags((playerId) => [
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station),
        ship(playerId, PieceType.Station)
    ])
    return { game, mover }
}

const bagOf = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.bag

describe('Conscription', () => {
    it('is not offered until a ship has been discarded this turn', () => {
        const { game, mover } = scenario()
        expect(game.state.machineState).toBe(MachineState.DraftingPieces)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseConscription)
        expect(() =>
            game.run(UseConscription, { type: ActionType.UseConscription, playerId: mover })
        ).toThrow()
    })

    it('puts the discarded ship back in the bag and starts its timer', () => {
        const { game, mover } = scenario()
        const thrown = game.state.heldPieces[0]
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: thrown.id
        })
        expect(bagOf(game, mover).remaining).toBe(1)
        expect(game.state.discardedThisTurn).toEqual([thrown])
        expect(game.validActionsFor(mover)).toContain(ActionType.UseConscription)

        const used = game
            .run(UseConscription, { type: ActionType.UseConscription, playerId: mover })
            .find(isUseConscription)

        expect(used?.metadata?.conscripted).toEqual([thrown])
        expect(bagOf(game, mover).remaining).toBe(2)
        expect(bagOf(game, mover).items.map((piece) => piece.id)).toContain(thrown.id)
        expect(game.state.discardedThisTurn).toBeUndefined()
        expect(game.state.heldPieces).toHaveLength(2)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        // Spent for now: not offered again, and three turns until it is ready.
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseConscription)
        expect(turnsUntilReady(game.hydrated, mover, TechnologyEffectKind.Conscription)).toBe(3)
    })

    it('forgets the discard when the turn is over', () => {
        const { game, mover } = scenario()
        const thrown = game.state.heldPieces[0]
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: thrown.id
        })
        // Both kept ships go down, and the turn is ended with Conscription unused.
        while (game.state.heldPieces.length > 0) {
            const [held] = game.state.heldPieces
            const [coords] = legalPlacementsFor(game.state.board, mover, held)
            game.run(PlacePiece, {
                type: ActionType.PlacePiece,
                playerId: mover,
                coords,
                pieceSource: PieceSource.Bag,
                pieceId: held.id
            })
        }
        expect(game.state.machineState).toBe(MachineState.EndingTurn)
        game.run(EndTurn, { type: ActionType.EndTurn, playerId: mover })

        expect(game.activePlayerId).not.toBe(mover)
        expect(game.state.discardedThisTurn).toBeUndefined()
        expect(bagOf(game, mover).items.map((piece) => piece.id)).not.toContain(thrown.id)
    })
})
