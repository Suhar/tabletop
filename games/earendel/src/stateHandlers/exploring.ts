import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ChoosePlanet, HydratedChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import {
    ChooseTechnology,
    HydratedChooseTechnology,
    isChooseTechnology
} from '../actions/chooseTechnology.js'
import { endTurn } from '../util/turn.js'

type ExploringAction = HydratedChoosePlanet | HydratedChooseTechnology

// Still the placing player's turn: their probe found something, and they owe up to two
// decisions - which planet to explore, then which revealed technology the planet keeps.
// Either can be a non-choice, in which case it is taken for them rather than shown.
//
// Transitions: Exploring(ChoosePlanet)     -> Exploring
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

        // A decision with one answer isn't a decision. Taking it as a system action keeps the
        // history complete (the flip is still recorded) without making the player click
        // through a dialog that offers them nothing.
        if (!pending.exploringPlanet) {
            if (pending.candidatePlanets.length === 1) {
                context.addSystemAction(ChoosePlanet, {
                    playerId: pending.playerId,
                    coords: pending.candidatePlanets[0]
                })
            }
            return
        }

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
