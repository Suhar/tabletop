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

// Still the placing player's turn: their probe landed beside a planet, and they owe up to two
// decisions - whether to survey a planet it leads on and which, then which revealed technology the
// planet keeps. The first is always a real choice, since not surveying is always allowed;
// the second is taken for them rather than shown when it has one answer.
//
// Transitions: Exploring(ChoosePlanet)     -> Exploring | PlacingPiece | EndOfGame
//              Exploring(ChooseTechnology) -> PlacingPiece | EndOfGame
export class ExploringStateHandler
    implements MachineStateHandler<ExploringAction, HydratedEarendelGameState>
{
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

        // The turn hasn't changed hands - the exploring player is still the active one - but
        // say so explicitly, since this state is reached from a placement and re-entered
        // after the planet is settled.
        gameState.activePlayerIds = [pending.playerId]

        // Whether to survey is always the player's to say - not surveying is an answer too.
        if (!pending.exploringPlanet) return

        // A decision with one answer isn't a decision. Taking it as a system action keeps the
        // history complete without making the player click through a dialog that offers them
        // nothing.

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
                // A probe kept on the board has nothing more to do.
                if (!action.coords) {
                    return endPlacement(gameState, context)
                }
                // The cards are face up now, so the second decision is waiting - same state,
                // whose enter() will resolve it outright if there's nothing to weigh.
                return MachineState.Exploring
            }
            case isChooseTechnology(action): {
                // A technology that acts the moment it is housed holds the turn open again.
                if (gameState.pendingTile) {
                    return MachineState.PlacingTile
                }
                if (gameState.pendingTechnology) {
                    return MachineState.ResolvingTechnology
                }
                return endPlacement(gameState, context)
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
