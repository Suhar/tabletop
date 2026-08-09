import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { endTurn } from '../util/turn.js'
import { hasOpenHex } from '../model/board.js'

type PlacingPieceAction = HydratedPlacePiece | HydratedPass

// A whole turn is one placement. This state is where every turn begins and, unless the
// placement was a probe that found something, where it ends.
//
// Transitions: PlacingPiece(PlacePiece) -> Exploring | PlacingPiece | EndOfGame
//              PlacingPiece(Pass)       -> PlacingPiece | EndOfGame
export class PlacingPieceStateHandler
    implements MachineStateHandler<PlacingPieceAction, HydratedEarendelGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is PlacingPieceAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece, ActionType.Pass].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: PlacingPieceAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlacePiece(action): {
                // A placement that owes the player a decision holds the turn open. A piece
                // is one type or the other, so these are never both pending: probes explore,
                // fighters shoot.
                if (gameState.pendingExploration) {
                    return MachineState.Exploring
                }
                if (gameState.pendingAttack) {
                    return MachineState.Attacking
                }
                return endTurn(gameState)
            }
            case isPass(action): {
                return endTurn(gameState)
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
        const playerState = gameState.findPlayerState(playerId)
        if (!playerState) return false

        const canPlaceSomewhere = hasOpenHex(gameState.board)

        switch (actionType) {
            case ActionType.PlacePiece: {
                if (!canPlaceSomewhere) return false
                return !playerState.bagIsEmpty || playerState.specialPieces.length > 0
            }
            case ActionType.Pass: {
                // Only ever a safety valve: a player with pieces and somewhere to put them
                // must place. Passing exists so a wholly blocked board can't wedge the game.
                return !canPlaceSomewhere
            }
        }
        return false
    }
}
