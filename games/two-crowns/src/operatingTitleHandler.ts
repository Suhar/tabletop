import type { HydratedAction, MachineContext } from '@tabletop/common'
import type { EighteenXXStateHandler, HydratedEighteenXXState } from '@tabletop/18xx'
import { EighteenXXTransferTiming, controllingOwner } from '@tabletop/18xx'
import {
    HydratedAssignAncona,
    HydratedBuyBerth,
    anconaAssignmentReason,
    berthPurchaseReason
} from './berths.js'

// Adds 1874's free operating-turn actions (Berths, the Ancona assignment) to an operating step.
export class TwoCrownsOperatingTitleHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    private titleAction(action: HydratedAction): action is HydratedBuyBerth | HydratedAssignAncona {
        return action instanceof HydratedBuyBerth || action instanceof HydratedAssignAncona
    }
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        return this.titleAction(action)
            ? action.isValid(context.gameState as never)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const state = context.gameState as never
        const companyId = EighteenXXTransferTiming.operatingCompany(context.gameState)
        if (companyId && controllingOwner(context.gameState, companyId)?.playerId === playerId) {
            if (!berthPurchaseReason(state, playerId, companyId)) actions.push('BuyBerth')
            if (!anconaAssignmentReason(state, playerId, companyId)) actions.push('AssignAncona')
        }
        return actions
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return this.titleAction(action)
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
