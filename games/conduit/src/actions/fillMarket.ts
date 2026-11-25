import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type MarketFilled = Type.Static<typeof MarketFilled>
export const MarketFilled = Type.Object({
    round: Type.Integer(),
    tileIds: Type.Array(Type.Integer())
})

// Turning over tiles from the stack is a reveal, so Undo cannot step back past it.
export type FillMarket = Type.Static<typeof FillMarket>
export const FillMarket = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.FillMarket),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(MarketFilled)
        })
    ])
)

export const FillMarketValidator = Compile(FillMarket)

export function isFillMarket(action?: GameAction): action is FillMarket {
    return action?.type === ActionType.FillMarket
}

export class HydratedFillMarket extends HydratableAction<typeof FillMarket> implements FillMarket {
    declare type: ActionType.FillMarket
    declare revealsInfo: true
    declare metadata?: MarketFilled

    constructor(data: FillMarket) {
        super(data, FillMarketValidator)
    }

    apply(state: HydratedConduitGameState) {
        const tileIds = state.fillMarket()
        this.metadata = { round: state.round, tileIds }
    }
}
