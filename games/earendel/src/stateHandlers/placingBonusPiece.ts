import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { endTurn } from '../util/turn.js'

type PlacingBonusPieceAction = HydratedPlacePiece

// The second half of the board-growing technology: a ship drawn and placed on the tile just
// laid. A real placement, so everything a placement triggers happens to it - a probe here
// explores, a fighter here shoots, a station here scores its group.
//
// Transitions: PlacingBonusPiece(PlacePiece) -> Exploring | Attacking | PlacingPiece | EndOfGame
export class PlacingBonusPieceStateHandler
    implements MachineStateHandler<PlacingBonusPieceAction, HydratedEarendelGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is PlacingBonusPieceAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.PlacePiece].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    // Nothing to do on entry: PlaceTile already drew the ship and only routed here when
    // there is one to place, so the turn can never arrive with nothing to do.
    enter(_context: MachineContext<HydratedEarendelGameState>) {}

    onAction(
        action: PlacingBonusPieceAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlacePiece(action): {
                gameState.bonusPlacementTileId = undefined
                if (gameState.pendingExploration) return MachineState.Exploring
                if (gameState.pendingAttack) return MachineState.Attacking
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
        if (!gameState.bonusPlacementTileId) return false
        if (!gameState.activePlayerIds.includes(playerId)) return false
        return actionType === ActionType.PlacePiece && gameState.drawnPiece !== undefined
    }
}
