import type { HydratedAction, MachineContext } from '@tabletop/common'
import type { EighteenXXStateHandler, HydratedEighteenXXState } from '@tabletop/18xx'
import { TwoCrownsBranchSplit } from './branchSplit.js'
import { HydratedSplitCompany } from './splitCompany.js'
import { HydratedConvertCharter, charterConversionReason } from './charterConversion.js'

export class TwoCrownsStockRoundHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        if (action instanceof HydratedConvertCharter) return action.isValid(context.gameState)
        return action instanceof HydratedSplitCompany
            ? action.isValid(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        const split = new TwoCrownsBranchSplit(context.gameState)
        if (split.branches().length && split.parents(playerId).some((parent) => !parent.reason))
            actions.push('SplitCompany')
        if (!charterConversionReason(context.gameState, playerId)) actions.push('ConvertCharter')
        return actions
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return action instanceof HydratedSplitCompany || action instanceof HydratedConvertCharter
            ? 'StockRound'
            : this.handler.onAction(action, context)
    }
}
