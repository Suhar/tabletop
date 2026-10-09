import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedRevealCard, isRevealCard } from '../actions/revealCard.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

// The round's first player opens their turn by revealing the next card, so the previous player
// can still undo their End turn until then.
export class RevealingCardStateHandler implements MachineStateHandler<
    HydratedRevealCard,
    HydratedMagnaGreciaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): action is HydratedRevealCard {
        return isRevealCard(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMagnaGreciaGameState>
    ): ActionType[] {
        return HydratedRevealCard.canRevealCard(context.gameState, playerId)
            ? [ActionType.RevealCard]
            : []
    }

    enter(context: MachineContext<HydratedMagnaGreciaGameState>) {
        context.gameState.beginTurn()
    }

    onAction(
        _action: HydratedRevealCard,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): MachineState {
        return MachineState.TakingTurn
    }
}
