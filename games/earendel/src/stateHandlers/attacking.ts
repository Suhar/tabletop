import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedDestroyPiece, isDestroyPiece } from '../actions/destroyPiece.js'
import { endTurn } from '../util/turn.js'

type AttackingAction = HydratedDestroyPiece

// Still the placing player's turn: their fighter landed next to something it could destroy.
//
// Unlike the exploration choices, this one is never taken on the player's behalf even when
// there is a single target - firing is optional, so one target is still a real decision.
//
// Transitions: Attacking(DestroyPiece) -> PlacingPiece | EndOfGame
export class AttackingStateHandler
    implements MachineStateHandler<AttackingAction, HydratedEarendelGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is AttackingAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.DestroyPiece].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const pending = context.gameState.pendingAttack
        if (!pending) return
        context.gameState.activePlayerIds = [pending.playerId]
    }

    onAction(
        action: AttackingAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isDestroyPiece(action): {
                return endTurn(context.gameState, context)
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
        const pending = context.gameState.pendingAttack
        if (!pending || pending.playerId !== playerId) return false
        return actionType === ActionType.DestroyPiece
    }
}
