import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type PlaceBid = Type.Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            spot: Type.Integer({ minimum: 1 })
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare spot: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedConduitGameState) {
        state.placeBid(this.playerId, this.spot)
    }

    static canPlaceBid(state: HydratedConduitGameState, playerId: string, spot: number): boolean {
        return state.canBid(playerId) && state.biddableSpots().includes(spot)
    }
}
