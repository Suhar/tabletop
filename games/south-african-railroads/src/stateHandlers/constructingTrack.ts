import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildConnection, isBuildConnection } from '../actions/buildConnection.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import { HydratedDelegateBuild, isDelegateBuild } from '../actions/delegateBuild.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { finishTurnAction, openZasm } from './flow.js'

type BuildAction = HydratedBuildTrack | HydratedBuildConnection
type ConstructingAction = BuildAction | HydratedDelegateBuild

export function buildActionsFor(state: HydratedSarGameState, playerId: string): ActionType[] {
    const available: [ActionType, boolean][] = [
        [ActionType.BuildTrack, HydratedBuildTrack.canBuild(state, playerId)],
        [ActionType.BuildConnection, HydratedBuildConnection.canBuildConnection(state, playerId)]
    ]
    return available.filter(([, allowed]) => allowed).map(([type]) => type)
}

export function afterBuild(action: BuildAction, state: HydratedSarGameState): MachineState {
    return isBuildTrack(action) && action.metadata?.opensZasm
        ? openZasm(state)
        : finishTurnAction(state)
}

export class ConstructingTrackStateHandler implements MachineStateHandler<
    ConstructingAction,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is ConstructingAction {
        return isBuildTrack(action) || isBuildConnection(action) || isDelegateBuild(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        const state = context.gameState
        if (state.turnPlayerId() !== playerId) {
            return []
        }
        return HydratedDelegateBuild.canDelegate(state, playerId)
            ? [ActionType.DelegateBuild]
            : buildActionsFor(state, playerId)
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        context.gameState.activePlayerIds = [context.gameState.turnPlayerId()]
    }

    onAction(
        action: ConstructingAction,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        if (isDelegateBuild(action)) {
            return MachineState.DelegatedBuild
        }
        return afterBuild(action, context.gameState)
    }
}
