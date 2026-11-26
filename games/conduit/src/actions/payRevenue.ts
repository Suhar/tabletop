import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState, StationRevenue } from '../model/gameState.js'

export type RevenuePaid = Type.Static<typeof RevenuePaid>
export const RevenuePaid = Type.Object({
    revenues: Type.Array(StationRevenue)
})

export type PayRevenue = Type.Static<typeof PayRevenue>
export const PayRevenue = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PayRevenue),
            metadata: Type.Optional(RevenuePaid)
        })
    ])
)

export const PayRevenueValidator = Compile(PayRevenue)

export function isPayRevenue(action?: GameAction): action is PayRevenue {
    return action?.type === ActionType.PayRevenue
}

export class HydratedPayRevenue extends HydratableAction<typeof PayRevenue> implements PayRevenue {
    declare type: ActionType.PayRevenue
    declare metadata?: RevenuePaid

    constructor(data: PayRevenue) {
        super(data, PayRevenueValidator)
    }

    apply(state: HydratedConduitGameState) {
        this.metadata = { revenues: state.payRevenue() }
    }
}
