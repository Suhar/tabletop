import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedPlaceTile, isPlaceTile, PlaceTile } from '../actions/placeTile.js'
import { legalTileOrigins } from '../util/tilePlacement.js'
import { endTurn } from '../util/turn.js'

type PlacingTileAction = HydratedPlaceTile

// Still the exploring player's turn: a technology has handed them a tile to lay.
//
// Transitions: PlacingTile(PlaceTile) -> PlacingBonusPiece | PlacingPiece | EndOfGame
export class PlacingTileStateHandler
    implements MachineStateHandler<PlacingTileAction, HydratedEarendelGameState>
{
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

        // Nowhere to lay it - the technology comes to nothing rather than wedging the turn.
        if (legalTileOrigins(gameState.board).length === 0) {
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
                // A tile actually laid owes a ship; one that couldn't be laid owes nothing.
                if (gameState.bonusPlacementTileId) {
                    return MachineState.PlacingBonusPiece
                }
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
        const pending = context.gameState.pendingTile
        if (!pending || pending.playerId !== playerId) return false
        return actionType === ActionType.PlaceTile
    }
}
