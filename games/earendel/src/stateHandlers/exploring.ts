import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import {
    ChooseTechnology,
    HydratedChooseTechnology,
    isChooseTechnology
} from '../actions/chooseTechnology.js'
import { endPlacement } from '../util/turn.js'

type ExploringAction = HydratedChoosePlanet | HydratedChooseTechnology

export class ExploringStateHandler implements MachineStateHandler<
    ExploringAction,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is ExploringAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return [ActionType.ChoosePlanet, ActionType.ChooseTechnology].filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const pending = gameState.pendingExploration
        if (!pending) return

        gameState.activePlayerIds = [pending.playerId]

        if (!pending.exploringPlanet) return

        const candidates = pending.candidates ?? []
        if (candidates.length <= 1) {
            context.addSystemAction(ChooseTechnology, {
                playerId: pending.playerId,
                ...(candidates.length === 1 ? { technologyId: candidates[0].id } : {})
            })
        }
    }

    onAction(
        action: ExploringAction,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isChoosePlanet(action): {
                if (!action.coords) {
                    return endPlacement(gameState, context, action)
                }
                return MachineState.Exploring
            }
            case isChooseTechnology(action): {
                if (gameState.pendingTile) {
                    return MachineState.PlacingTile
                }
                if (gameState.pendingTechnology) {
                    return MachineState.ResolvingTechnology
                }
                return endPlacement(gameState, context, action)
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
        const pending = context.gameState.pendingExploration
        if (!pending || pending.playerId !== playerId) return false

        switch (actionType) {
            case ActionType.ChoosePlanet: {
                return pending.exploringPlanet === undefined
            }
            case ActionType.ChooseTechnology: {
                return pending.exploringPlanet !== undefined
            }
        }
        return false
    }
}
