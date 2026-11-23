import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedAttackSpread, isAttackSpread } from '../actions/attackSpread.js'
import { canUseCooldownEffect } from '../util/cooldowns.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { AttackPiece, HydratedAttackPiece, isAttackPiece } from '../actions/attackPiece.js'
import { endPlacement } from '../util/turn.js'
import { isTorpedoAt } from '../util/attack.js'

type AttackingAction = HydratedAttackPiece | HydratedAttackSpread

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

        // A torpedo must strike, so with one station beside it there is nothing to choose.
        if (
            isTorpedoAt(context.gameState.board, pending.fighterCoords) &&
            pending.targets.length === 1
        ) {
            context.addSystemAction(AttackPiece, {
                playerId: pending.playerId,
                coords: pending.targets[0]
            })
        }
    }

    onAction(
        action: AttackingAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isAttackPiece(action):
            case isAttackSpread(action): {
                return endPlacement(context.gameState, context)
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
            return (
                pending.targets.length > 1 &&
                !isTorpedoAt(context.gameState.board, pending.fighterCoords) &&
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
