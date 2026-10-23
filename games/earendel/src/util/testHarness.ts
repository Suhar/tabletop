import {
    assert,
    type Game,
    GameAction,
    GameEngine,
    type GameStartOptions,
    GameStatus,
    type Player,
    PlayerStatus,
    createAction
} from '@tabletop/common'
import type * as Type from 'typebox'
import { Value } from 'typebox/value'
import { EarendelRuntime } from '../definition/runtime.js'
import { type EarendelGameConfig, TurnStyle } from '../definition/config.js'
import { type EarendelGameState, HydratedEarendelGameState } from '../model/gameState.js'
import type { Piece } from '../model/pieces.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { bagOf, drawFrom } from './drawBags.js'

export class TestGame {
    readonly engine = new GameEngine<EarendelGameState, HydratedEarendelGameState>(EarendelRuntime)
    readonly game: Game
    state: EarendelGameState
    readonly processed: GameAction[] = []

    constructor(
        playerCount = 2,
        seed = 1,
        config: EarendelGameConfig = { turnStyle: TurnStyle.SinglePiece },
        start: GameStartOptions = {}
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

        const { startedGame, initialState } = this.engine.startGame(game, start)
        this.game = startedGame
        this.state = initialState
    }

    stackBags(bag: (playerId: string) => Piece[]) {
        for (const player of this.state.players) {
            player.bag = bagOf(bag(player.playerId))
        }

        const playerId = this.activePlayerId
        if (this.validActionsFor(playerId).includes(ActionType.DrawPieces)) {
            this.run(DrawPieces, { type: ActionType.DrawPieces, playerId })
            return
        }

        const active = this.state.players.find((player) => player.playerId === playerId)!
        const wanted = Math.max(1, this.state.heldPieces.length)
        this.state.heldPieces = []
        for (let drawn = 0; drawn < wanted; drawn++) {
            const piece = drawFrom(active.bag)
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

    run<T extends Type.TSchema>(
        schema: T,
        data: Partial<Type.Static<T>> & { type: string; playerId?: string }
    ): GameAction[] {
        if (
            this.state.machineState === MachineState.StartOfTurn &&
            data.type !== ActionType.DrawPieces
        ) {
            this.run(DrawPieces, { type: ActionType.DrawPieces, playerId: this.activePlayerId })
        }

        return this.submit(schema, data)
    }

    private submit<T extends Type.TSchema>(schema: T, data: Partial<Type.Static<T>>): GameAction[] {
        const action = createAction(schema, { ...data, gameId: this.game.id })
        assert(Value.Check(GameAction, action), 'Test actions must be game actions')

        const result = this.engine.executeAction({ action, state: this.state, game: this.game })
        this.state = result.updatedState
        this.processed.push(...result.processedActions)
        return result.processedActions
    }

    validActionsFor(playerId: string): string[] {
        return this.engine.getValidActionTypesForPlayer(this.game, this.state, playerId)
    }
}
