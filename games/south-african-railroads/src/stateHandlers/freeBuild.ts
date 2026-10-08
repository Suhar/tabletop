import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildTrack, isBuildTrack } from '../actions/buildTrack.js'
import type { HydratedSarGameState } from '../model/gameState.js'
import { afterFreeBuild } from './flow.js'

export class FreeBuildStateHandler implements MachineStateHandler<
    HydratedBuildTrack,
    HydratedSarGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedSarGameState>
    ): action is HydratedBuildTrack {
        return isBuildTrack(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedSarGameState>
    ): ActionType[] {
        return HydratedBuildTrack.canBuild(context.gameState, playerId)
            ? [ActionType.BuildTrack]
            : []
    }

    enter(context: MachineContext<HydratedSarGameState>) {
        const due = context.gameState.freeBuild
        context.gameState.activePlayerIds = due ? [due.playerId] : []
    }

    onAction(
        action: HydratedBuildTrack,
        context: MachineContext<HydratedSarGameState>
    ): MachineState {
        return afterFreeBuild(context.gameState, action.railroadId, action.playerId)
    }
}
