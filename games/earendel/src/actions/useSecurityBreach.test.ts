import { describe, expect, it } from 'vitest'
import { type Piece, PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { TurnStyle } from '../definition/config.js'
import { MachineState } from '../definition/states.js'
import { DiscardPiece, isDiscardPiece } from './discardPiece.js'
import { UseSecurityBreach } from './useSecurityBreach.js'
import { PlayScrap } from './playScrap.js'
import { legalPlacementsFor } from '../util/placement.js'
import { TestGame } from '../testing/testHarness.js'

let ids = 0
const piece = (playerId: string, type: PieceType): Piece => ({
    id: `${playerId}-${type}-${ids++}`,
    playerId,
    type
})

const breach = (playerId: string, targetPlayerId: string) => ({
    type: ActionType.UseSecurityBreach as const,
    playerId,
    targetPlayerId
})

const bagOf = (game: TestGame, playerId: string) =>
    game.state.players.find((p) => p.playerId === playerId)!.bag

describe('Security Breach', () => {
    it("puts one Scrap into the chosen opponent's bag and is spent", () => {
        const game = new TestGame(3)
        const mover = game.activePlayerId
        const [rival, other] = game.state.players
            .map((p) => p.playerId)
            .filter((id) => id !== mover)
        game.giveTechnology(mover, TechnologyEffectKind.SecurityBreach)

        game.run(UseSecurityBreach, breach(mover, rival))

        const scrap = bagOf(game, rival).items.filter((item) => item.type === PieceType.Scrap)
        expect(scrap).toHaveLength(1)
        expect(scrap[0]).toMatchObject({ playerId: rival })
        expect(scrap[0].id).toMatch(new RegExp(`^${rival}-ship-[0-9a-z]+$`))
        expect(bagOf(game, rival).remaining).toBe(23)
        expect(bagOf(game, other).remaining).toBe(22)
        expect(game.state.players.find((p) => p.playerId === mover)!.storedEffects).toEqual([])
        expect(game.validActionsFor(mover)).not.toContain(ActionType.UseSecurityBreach)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
    })

    it('needs an opponent, and the technology', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        const rival = game.state.players.find((p) => p.playerId !== mover)!.playerId
        expect(() => game.run(UseSecurityBreach, breach(mover, rival))).toThrow()
        game.giveTechnology(mover, TechnologyEffectKind.SecurityBreach)
        expect(() => game.run(UseSecurityBreach, breach(mover, mover))).toThrow()
        expect(() => game.run(UseSecurityBreach, breach(mover, 'nobody'))).toThrow()
    })
})

describe('Scrap', () => {
    it('cannot be placed, and goes back into the bag when discarded', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId
        game.stackBags((playerId) => [
            piece(playerId, PieceType.Scrap),
            piece(playerId, PieceType.Station),
            piece(playerId, PieceType.Station),
            piece(playerId, PieceType.Station)
        ])
        const scrap = game.state.heldPieces.find((held) => held.type === PieceType.Scrap)!
        expect(legalPlacementsFor(game.state.board, mover, scrap)).toEqual([])

        const discard = game
            .run(DiscardPiece, {
                type: ActionType.DiscardPiece,
                playerId: mover,
                pieceId: scrap.id
            })
            .find(isDiscardPiece)

        expect(discard?.metadata?.recycled).toBe(true)
        expect(bagOf(game, mover).items.map((item) => item.id)).toContain(scrap.id)
        expect(game.state.heldPieces).toHaveLength(2)
    })

    it('played from the hand, does nothing and is gone for good', () => {
        const game = new TestGame(2, 1, { turnStyle: TurnStyle.DraftThree })
        const mover = game.activePlayerId
        game.stackBags((playerId) => [
            piece(playerId, PieceType.Scrap),
            piece(playerId, PieceType.Station),
            piece(playerId, PieceType.Station),
            piece(playerId, PieceType.Station)
        ])
        const scrap = game.state.heldPieces.find((held) => held.type === PieceType.Scrap)!
        const station = game.state.heldPieces.find((held) => held.type === PieceType.Station)!
        // Not while the draft's discard is still owed.
        expect(game.validActionsFor(mover)).not.toContain(ActionType.PlayScrap)
        game.run(DiscardPiece, {
            type: ActionType.DiscardPiece,
            playerId: mover,
            pieceId: station.id
        })
        expect(game.validActionsFor(mover)).toContain(ActionType.PlayScrap)
        const score = game.state.players.find((p) => p.playerId === mover)!.score
        const board = structuredClone(game.state.board)

        game.run(PlayScrap, { type: ActionType.PlayScrap, playerId: mover, pieceId: scrap.id })

        expect(game.state.heldPieces.map((held) => held.type)).toEqual([PieceType.Station])
        expect(bagOf(game, mover).items.some((item) => item.type === PieceType.Scrap)).toBe(false)
        expect(game.state.board).toEqual(board)
        expect(game.state.players.find((p) => p.playerId === mover)!.score).toBe(score)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.activePlayerId).toBe(mover)
        expect(game.validActionsFor(mover)).not.toContain(ActionType.PlayScrap)
    })

    it('alone in hand, is played rather than ending the game', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        game.stackBags((playerId) => [
            piece(playerId, PieceType.Scrap),
            piece(playerId, PieceType.Station)
        ])
        const [scrap] = game.state.heldPieces
        expect(scrap.type).toBe(PieceType.Scrap)
        expect(game.state.machineState).toBe(MachineState.PlacingPiece)
        expect(game.validActionsFor(mover)).toEqual([ActionType.PlayScrap])

        game.run(PlayScrap, { type: ActionType.PlayScrap, playerId: mover, pieceId: scrap.id })

        expect(game.state.machineState).not.toBe(MachineState.EndOfGame)
        expect(game.activePlayerId).not.toBe(mover)
    })

    it('is refused for anything that is not a Scrap in hand', () => {
        const game = new TestGame()
        const mover = game.activePlayerId
        game.stackBags((playerId) => [piece(playerId, PieceType.Station)])
        const [station] = game.state.heldPieces
        expect(() =>
            game.run(PlayScrap, {
                type: ActionType.PlayScrap,
                playerId: mover,
                pieceId: station.id
            })
        ).toThrow()
    })
})
