import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState, Payment } from '../model/gameState.js'

export type TileBought = Type.Static<typeof TileBought>
export const TileBought = Type.Object({
    tileId: Type.Integer(),
    price: Type.Integer(),
    payments: Type.Array(Payment)
})

export type BuyTile = Type.Static<typeof BuyTile>
export const BuyTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyTile),
            playerId: Type.String(),
            metadata: Type.Optional(TileBought)
        })
    ])
)

export const BuyTileValidator = Compile(BuyTile)

export function isBuyTile(action?: GameAction): action is BuyTile {
    return action?.type === ActionType.BuyTile
}

export class HydratedBuyTile extends HydratableAction<typeof BuyTile> implements BuyTile {
    declare type: ActionType.BuyTile
    declare playerId: string
    declare metadata?: TileBought

    constructor(data: BuyTile) {
        super(data, BuyTileValidator)
    }

    apply(state: HydratedConduitGameState) {
        const offer = state.currentOffer()
        assertExists(offer, 'A tile is on offer')
        this.metadata = {
            tileId: offer.tileId,
            price: offer.price,
            payments: state.buyTile(this.playerId)
        }
    }

    static canBuyTile(state: HydratedConduitGameState, playerId: string): boolean {
        return state.currentOffer()?.playerId === playerId && state.canAfford(playerId)
    }
}
