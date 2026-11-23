import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { HydratedSeedNebula, isSeedNebula, SeedNebula } from '../actions/seedNebula.js'
import { seedableHexes } from '../util/specials.js'
import { afterDraw } from '../util/turn.js'

// The player's nebula seeders each lay one hex, or the player leaves them be (rules.md, Granted
// pieces).
export class SeedingStateHandler implements MachineStateHandler<
    HydratedSeedNebula,
    HydratedEarendelGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEarendelGameState>
    ): action is HydratedSeedNebula {
        if (!action.playerId) return false
        return this.validActionsForPlayer(action.playerId, context).some(
            (type) => type === action.type
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEarendelGameState>
    ): ActionType[] {
        return context.gameState.pendingSeeding?.playerId === playerId
            ? [ActionType.SeedNebula]
            : []
    }

    enter(context: MachineContext<HydratedEarendelGameState>) {
        const gameState = context.gameState
        const pending = gameState.pendingSeeding
        if (!pending) return
        gameState.activePlayerIds = [pending.playerId]

        // Nothing left to lay: the seeders are done for the turn.
        const canSeed = pending.seeders.some(
            (seeder) => seedableHexes(gameState.board, seeder).length > 0
        )
        if (!canSeed) context.addSystemAction(SeedNebula, { playerId: pending.playerId })
    }

    onAction(
        action: HydratedSeedNebula,
        context: MachineContext<HydratedEarendelGameState>
    ): MachineState {
        if (!isSeedNebula(action)) throw Error('Invalid action type')
        const gameState = context.gameState
        if (gameState.pendingSeeding) return MachineState.Seeding
        return afterDraw(gameState, context)
    }
}
