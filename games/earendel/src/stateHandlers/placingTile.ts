import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlaceTile, isPlaceTile, PlaceTile } from '../actions/placeTile.js'
import { legalTilePlacements } from '../util/tilePlacement.js'
import { afterTechnologyEffect } from '../util/turn.js'

type PlacingTileAction = HydratedPlaceTile

export class PlacingTileStateHandler implements MachineStateHandler<
    PlacingTileAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is PlacingTileAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.PlaceTile].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const pending = gameState.pendingTile
        if (!pending) return

        gameState.activePlayerIds = [pending.playerId]

        if (legalTilePlacements(gameState.board).length === 0) {
            context.addSystemAction(PlaceTile, { playerId: pending.playerId })
        }
    }

    onAction(
        action: PlacingTileAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlaceTile(action): {
                if (gameState.bonusPlacementTileId) {
                    return MachineState.PlacingBonusPiece
                }
                return afterTechnologyEffect(action, gameState, context)
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
        const pending = context.gameState.pendingTile
        if (!pending || pending.playerId !== playerId) return false
        return actionType === ActionType.PlaceTile
    }
}
