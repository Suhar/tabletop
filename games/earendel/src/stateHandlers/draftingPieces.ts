import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { endPlacement, keepCountForPlayer } from '../util/turn.js'
import { earendelConfig } from '../definition/config.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { DiscardPiece, HydratedDiscardPiece } from '../actions/discardPiece.js'
import { HydratedUseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'

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
        const playerId = gameState.activePlayerIds[0]

        const keep = keepCountForPlayer(gameState, playerId, earendelConfig(context.gameConfig))
        if (gameState.heldPieces.length <= keep) {
            context.addSystemAction(DiscardPiece, { playerId })
        }
    }

    onAction(
        action: DraftingAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        // A Deep Scanner's extra ship leaves a second discard to make.
        if (context.gameState.draftPending) return MachineState.DraftingPieces
        return endPlacement(context.gameState, context)
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
                canUseCooldownEffect(gameState, playerId, TechnologyEffectKind.LogisticsUpgrade)
            )
        }

        return actionType === ActionType.DiscardPiece
    }
}
