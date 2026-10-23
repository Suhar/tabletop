import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { endPlacement } from '../util/turn.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { DiscardPiece, HydratedDiscardPiece } from '../actions/discardPiece.js'
import { HydratedUseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { TechnologyEffectKind } from '../model/technology.js'

type DraftingAction = HydratedDiscardPiece | HydratedUseLogisticsUpgrade

export class DraftingPiecesStateHandler implements MachineStateHandler<
    DraftingAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is DraftingAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.DiscardPiece, ActionType.UseLogisticsUpgrade].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState

        if (gameState.heldPieces.length <= 1) {
            context.addSystemAction(DiscardPiece, { playerId: gameState.activePlayerIds[0] })
        }
    }

    onAction(
        _action: DraftingAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        return endPlacement(_context.gameState, _context)
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) return false

        if (actionType === ActionType.UseLogisticsUpgrade) {
            return (
                gameState.heldPieces.length > 1 &&
                gameState
                    .getPlayerState(playerId)
                    .hasStoredEffect(TechnologyEffectKind.LogisticsUpgrade)
            )
        }

        return actionType === ActionType.DiscardPiece
    }
}
