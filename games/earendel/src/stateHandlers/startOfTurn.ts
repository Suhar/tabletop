import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedDrawPieces, isDrawPieces } from '../actions/drawPieces.js'
import { afterDraw } from '../util/turn.js'

type StartOfTurnAction = HydratedDrawPieces

// Where every turn begins, in either turn style: the turn is handed on, and then it waits.
//
// Nothing is drawn until the player asks for it. That is the whole point of the state - the
// draw is what makes hidden information public, and until it happens the player before them
// can still take their own turn back.
//
// Transitions: StartOfTurn(DrawPieces) -> PlacingTile | ResolvingTechnology | DraftingPieces
//               | PlacingPiece | EndOfGame
export class StartOfTurnStateHandler implements MachineStateHandler<
    StartOfTurnAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is StartOfTurnAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.DrawPieces].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState

        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
        gameState.heldPieces = []
    }

    onAction(
        action: StartOfTurnAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isDrawPieces(action): {
                // Technologies claimed by this draw act before anything else - see afterDraw,
                // which also knows whether a discard is still owed behind them.
                return afterDraw(context.gameState, context, action)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) return false
        return actionType === ActionType.DrawPieces && gameState.heldPieces.length === 0
    }
}
