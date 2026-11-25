import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type TilePassed = Type.Static<typeof TilePassed>
export const TilePassed = Type.Object({
    tileId: Type.Integer(),
    price: Type.Integer(),
    // The passer's cubes taken off the bottom of the track together.
    cubes: Type.Integer()
})

export type PassTile = Type.Static<typeof PassTile>
export const PassTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassTile),
            playerId: Type.String(),
            metadata: Type.Optional(TilePassed)
        })
    ])
)

export const PassTileValidator = Compile(PassTile)

export function isPassTile(action?: GameAction): action is PassTile {
    return action?.type === ActionType.PassTile
}

export class HydratedPassTile extends HydratableAction<typeof PassTile> implements PassTile {
    declare type: ActionType.PassTile
    declare playerId: string
    declare metadata?: TilePassed

    constructor(data: PassTile) {
        super(data, PassTileValidator)
    }

    apply(state: HydratedConduitGameState) {
        const offer = state.currentOffer()
        assertExists(offer, 'A tile is on offer')
        this.metadata = {
            tileId: offer.tileId,
            price: offer.price,
            cubes: state.passTile(this.playerId)
        }
    }

    static canPassTile(state: HydratedConduitGameState, playerId: string): boolean {
        return state.currentOffer()?.playerId === playerId
    }
}
