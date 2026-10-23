import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { afterDraw } from '../util/turn.js'

type PlacingBonusPieceAction = HydratedPlacePiece

export class PlacingBonusPieceStateHandler implements MachineStateHandler<
    PlacingBonusPieceAction,
    HydratedEarendelGameState
> {
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

    enter(_context: MachineContext<HydratedEarendelGameState>) {}

    onAction(
        action: PlacingBonusPieceAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlacePiece(action): {
                gameState.bonusPlacementTileId = undefined
                gameState.bonusPlacementPieceId = undefined
                if (gameState.pendingExploration) return MachineState.Exploring
                if (gameState.pendingAttack) return MachineState.Attacking
                // afterDraw, not endPlacement: this detour can start before the draft discard is made.
                return afterDraw(gameState, context, action)
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
        return actionType === ActionType.PlacePiece && gameState.heldPieces.length > 0
    }
}
