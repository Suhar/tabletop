import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedAttackSpread, isAttackSpread } from '../actions/attackSpread.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedAttackPiece, isAttackPiece } from '../actions/attackPiece.js'
import { endPlacement } from '../util/turn.js'

type AttackingAction = HydratedAttackPiece | HydratedAttackSpread

// Still the placing player's turn: their fighter landed next to something it could destroy.
//
// Unlike the exploration choices, this one is never taken on the player's behalf even when
// there is a single target - firing is optional, so one target is still a real decision.
//
// Transitions: Attacking(AttackPiece) -> PlacingPiece | EndOfGame
export class AttackingStateHandler implements MachineStateHandler<
    AttackingAction,
    HydratedEarendelGameState
> {
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
        return [ActionType.AttackPiece, ActionType.AttackSpread].filter((actionType) =>
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
            case isAttackPiece(action):
            case isAttackSpread(action): {
                // Both end the shot, so both hand the turn back the same way.
                return endPlacement(context.gameState, context, action)
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

        if (actionType === ActionType.AttackSpread) {
            // Only worth offering with something to spread ACROSS: on a single target it is an
            // ordinary shot, and spending three turns of a power on that is a trap rather than a
            // choice.
            return (
                pending.targets.length > 1 &&
                canUseCooldownEffect(
                    context.gameState,
                    playerId,
                    TechnologyEffectKind.FullTorpedoSpread
                )
            )
        }

        return actionType === ActionType.AttackPiece
    }
}
