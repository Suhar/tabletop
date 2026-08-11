import {
    type Game,
    type GameAction,
    GameEngine,
    GameStatus,
    type Player,
    PlayerStatus,
    createAction
} from '@tabletop/common'
import type * as Type from 'typebox'
import { EarendelRuntime } from '../definition/runtime.js'
import { type EarendelGameConfig, TurnStyle } from '../definition/config.js'
import { type EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import type { Piece } from '../model/pieces.js'

// A game driven through the real engine rather than by calling apply() directly. Anything
// about the turn spine - who is active, when a turn ends, which system actions fire - is only
// honestly testable this way, since the engine, not the action, is what decides it.
export class TestGame {
    readonly engine = new GameEngine<EarendelGameState, HydratedEarendelGameState>(EarendelRuntime)
    readonly game: Game
    state: EarendelGameState
    readonly processed: GameAction[] = []

    // Defaults to the simple one-draw turn, so a test about chains or blockades exercises one
    // mechanic rather than two. Tests about the drafted turn ask for it explicitly, and the
    // simulation runs the real default.
    constructor(
        playerCount = 2,
        seed = 1,
        config: EarendelGameConfig = { turnStyle: TurnStyle.SinglePiece }
    ) {
        const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
            id: `p${index + 1}`,
            isHuman: true,
            name: `Player ${index + 1}`,
            status: PlayerStatus.Joined
        }))

        const game: Game = {
            id: 'game-1',
            typeId: 'earendel',
            status: GameStatus.WaitingToStart,
            isPublic: false,
            deleted: false,
            ownerId: 'p1',
            name: 'Test',
            players,
            config,
            hotseat: true,
            createdAt: new Date(),
            winningPlayerIds: [],
            seed
        }

        const { startedGame, initialState } = this.engine.startGame(game)
        this.game = startedGame
        this.state = initialState
    }

    // Replaces every player's bag with a known stack. The turn's opening draw has already
    // happened by the time a test can do this, so the piece on the table is drawn again from
    // the new bag - otherwise the first placement of every test would use a random piece
    // from the generated bag.
    stackBags(bag: (playerId: string) => Piece[]) {
        for (const player of this.state.players) {
            player.bag = bag(player.playerId)
        }
        // Redraw whatever the opening of the turn had already taken, so the hand comes from
        // the stack just set rather than from the generated bag.
        const active = this.state.players.find(
            (player) => player.playerId === this.activePlayerId
        )!
        const wanted = Math.max(1, this.state.heldPieces.length)
        this.state.heldPieces = []
        for (let drawn = 0; drawn < wanted; drawn++) {
            const piece = active.bag.shift()
            if (!piece) break
            this.state.heldPieces.push(piece)
        }
    }

    get hydrated(): HydratedEarendelGameState {
        return new HydratedEarendelGameState(structuredClone(this.state))
    }

    get activePlayerId(): string {
        return this.state.activePlayerIds[0]
    }

    // Submits an action the way the server does, and keeps every action the engine produced -
    // system actions included, which is where auto-resolved choices show up.
    run<T extends Type.TSchema>(schema: T, data: Partial<Type.Static<T>>): GameAction[] {
        const action = createAction(schema, {
            gameId: this.game.id,
            ...data
        } as Partial<Type.Static<T>>) as GameAction

        const result = this.engine.run(action, this.state, this.game)
        this.state = result.updatedState
        this.processed.push(...result.processedActions)
        return result.processedActions
    }

    validActionsFor(playerId: string): string[] {
        return this.engine.getValidActionTypesForPlayer(this.game, this.state, playerId)
    }
}
