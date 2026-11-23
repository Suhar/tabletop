import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedStowShip, isStowShip } from '../actions/stowShip.js'
import { nextToOpen } from './placingOpeningStation.js'

type StowingShipAction = HydratedStowShip

// The opening (rules.md, Setup): just before placing their free station, each player stows one
// more ship of their choice in their bag, unseen by the others.
export class StowingShipStateHandler implements MachineStateHandler<
    StowingShipAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is StowingShipAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.StowShip].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const playerId = nextToOpen(gameState)
        if (!playerId) return
        gameState.activePlayerIds = [playerId]
        gameState.heldPieces = []
    }

    onAction(
        action: StowingShipAction,
        _context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        switch (true) {
            case isStowShip(action): {
                return MachineState.PlacingOpeningStation
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
        if (!context.gameState.activePlayerIds.includes(playerId)) return false
        return actionType === ActionType.StowShip
    }
}
