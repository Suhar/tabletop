import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { beginPlacement } from '../util/turn.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { DiscardPiece, HydratedDiscardPiece } from '../actions/discardPiece.js'
import { HydratedUseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { TechnologyEffectKind } from '../model/technology.js'

type DraftingAction = HydratedDiscardPiece | HydratedUseLogisticsUpgrade

// The opening of a drafted turn: draw three, throw one away, then place the other two.
//
// This is where the turn begins in the drafting style, so it is here that the turn is handed
// on and the draw happens - PlacingPiece only takes over once there is a hand to place from.
//
// Transitions: DraftingPieces(DiscardPiece) -> PlacingPiece | EndOfGame
export class DraftingPiecesStateHandler
    implements MachineStateHandler<DraftingAction, HydratedEarendelGameState>
{
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
        // The turn and the draw are both already done - StartOfTurn handed the turn on and the
        // player drew - so all that is left is to notice when there is nothing to choose
        // between and take the discard for them.
        const gameState = context.gameState

        if (gameState.heldPieces.length <= 1) {
            context.addSystemAction(DiscardPiece, { playerId: gameState.activePlayerIds[0] })
        }
    }

    onAction(
        _action: DraftingAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        // The hand is settled now, so this is where a technology claimed at the top of the
        // turn gets to act - after the discard, not before it.
        return beginPlacement(_context.gameState)
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): boolean {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) return false

        if (actionType === ActionType.UseLogisticsUpgrade) {
            // Only worth offering when there is something to save, and only to a player
            // holding the charge.
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
