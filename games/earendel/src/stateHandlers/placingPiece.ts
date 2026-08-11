import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { endTurn } from '../util/turn.js'
import { hasAnyPlacement } from '../util/placement.js'

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

        // A hand already in play means this is the same turn continuing - a drafted turn has
        // two placements in it - so the turn is neither handed on nor drawn for again.
        if (gameState.heldPieces.length > 0) {
            const current = gameState.turnManager.currentTurn()
            if (current) gameState.activePlayerIds = [current.playerId]
            this.endGameIfStuck(context, gameState.activePlayerIds[0])
            return
        }

        // Otherwise this is the start of a simple turn: hand it on and draw the one ship.
        // Knowing what you drew before choosing a hex is what makes the placement a decision,
        // and a player who doesn't like it may put it back for a special piece instead.
        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]

        const playerState = gameState.getPlayerState(nextPlayerId)
        const drawn = playerState.drawFromBag()
        gameState.heldPieces = drawn ? [drawn] : []

        this.endGameIfStuck(context, nextPlayerId)
    }

    // A player who cannot legally place anything they hold, and has no special piece they could
    // place instead, ends the game. This can only be judged once there is a hand: a hex closed
    // to a probe is wide open to a fighter, so the answer depends on what came out of the bag.
    //
    // Checked on a continuing turn too, not just at the start of one - a drafted turn can place
    // its first ship into the last hex its second ship could have used. The Pass is a system
    // action so the ending is recorded rather than silently arrived at.
    private endGameIfStuck(
        context: MachineContext<HydratedEarendelGameState>,
        playerId: string | undefined
    ) {
        if (!playerId) return
        const gameState = context.gameState

        const stuck = !hasAnyPlacement(
            gameState.board,
            playerId,
            gameState.heldPieces,
            gameState.getPlayerState(playerId).specialPieces
        )

        if (stuck) {
            context.addSystemAction(Pass, { playerId })
        }
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
                // A drafted turn has a second ship to place, and stays with the same player.
                if (gameState.heldPieces.length > 0) {
                    return MachineState.PlacingPiece
                }
                return endTurn(gameState, context)
            }
            case isPass(action): {
                // Only ever reached when the player had nothing they could legally place,
                // which is itself the end of the game.
                return MachineState.EndOfGame
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

        // Asked of the pieces actually in hand, not of the board alone: a station blockade
        // can shut every open hex to a probe while leaving them all open to a fighter.
        const canPlace = hasAnyPlacement(
            gameState.board,
            playerId,
            gameState.heldPieces,
            playerState.specialPieces
        )

        switch (actionType) {
            case ActionType.PlacePiece: {
                return canPlace
            }
            case ActionType.Pass: {
                // Only ever a safety valve: a player with something they can place must
                // place it. This covers a full board, and the subtler case of drawing a probe
                // when every open hex is closed to probes - the draw goes back in the bag.
                return !canPlace
            }
        }
        return false
    }
}
