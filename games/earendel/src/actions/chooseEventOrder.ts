import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// The discoverer of an elevated event sets the order the others pick in, themselves first
// (rules.md, Elevated technologies).
export type ChooseEventOrder = Type.Static<typeof ChooseEventOrder>
export const ChooseEventOrder = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseEventOrder),
            playerId: Type.String(),
            order: Type.Array(Type.String())
        })
    ])
)

export const ChooseEventOrderValidator = Compile(ChooseEventOrder)

export function isChooseEventOrder(action?: GameAction): action is ChooseEventOrder {
    return action?.type === ActionType.ChooseEventOrder
}

export class HydratedChooseEventOrder
    extends HydratableAction<typeof ChooseEventOrder>
    implements ChooseEventOrder
{
    declare type: ActionType.ChooseEventOrder
    declare playerId: string
    declare order: string[]

    constructor(data: ChooseEventOrder) {
        super(data, ChooseEventOrderValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidChooseEventOrderReason(state)
        if (invalidReason) {
            throw Error(`Invalid ChooseEventOrder action: ${invalidReason}`)
        }
        state.pendingEvent!.order = [...this.order]
    }

    isValidChooseEventOrder(state: HydratedEarendelGameState): boolean {
        return this.invalidChooseEventOrderReason(state) === undefined
    }

    invalidChooseEventOrderReason(state: HydratedEarendelGameState): string | undefined {
        const pending = state.pendingEvent
        if (!pending) return 'No elevated event is waiting for an order.'
        if (pending.order) return 'The order is already set.'
        if (pending.discovererId !== this.playerId) return 'The discoverer sets the order.'
        if (this.order[0] !== this.playerId) return 'The discoverer goes first.'
        const everyone = state.players.map((player) => player.playerId)
        if (
            this.order.length !== everyone.length ||
            everyone.some((playerId) => !this.order.includes(playerId)) ||
            new Set(this.order).size !== this.order.length
        ) {
            return 'Every player goes exactly once.'
        }
        return undefined
    }
}
