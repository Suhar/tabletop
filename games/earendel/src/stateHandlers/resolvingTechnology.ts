import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedMovePiece, isMovePiece, MovePiece } from '../actions/movePiece.js'
import { legalMovesFor } from '../util/movement.js'
import { afterTechnologyEffect } from '../util/turn.js'

type ResolvingTechnologyAction = HydratedMovePiece

export class ResolvingTechnologyStateHandler implements MachineStateHandler<
    ResolvingTechnologyAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is ResolvingTechnologyAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.MovePiece].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const pending = gameState.pendingTechnology
        if (!pending) return

        gameState.activePlayerIds = [pending.playerId]

        if (legalMovesFor(gameState.board, pending.playerId).length === 0) {
            context.addSystemAction(MovePiece, { playerId: pending.playerId })
        }
    }

    onAction(
        action: ResolvingTechnologyAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isMovePiece(action): {
                return afterTechnologyEffect(action, context.gameState, context)
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
        const pending = context.gameState.pendingTechnology
        if (!pending || pending.playerId !== playerId) return false
        return actionType === ActionType.MovePiece
    }
}
