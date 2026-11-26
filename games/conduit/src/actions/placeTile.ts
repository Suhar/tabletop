import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { extraCubesPrice, MaxExtraCubes } from '../model/rules.js'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type TilePlaced = Type.Static<typeof TilePlaced>
export const TilePlaced = Type.Object({
    tileId: Type.Integer(),
    faceUp: Type.Boolean(),
    extraPrice: Type.Optional(Type.Integer({ minimum: 0 }))
})

export type PlaceTile = Type.Static<typeof PlaceTile>
export const PlaceTile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceTile),
            playerId: Type.String(),
            cell: OffsetCoordinates,
            rotation: Type.Integer({ minimum: 0, maximum: 3 }),
            extraCubes: Type.Integer({ minimum: 0 }),
            metadata: Type.Optional(TilePlaced)
        })
    ])
)

export const PlaceTileValidator = Compile(PlaceTile)

export function isPlaceTile(action?: GameAction): action is PlaceTile {
    return action?.type === ActionType.PlaceTile
}

export class HydratedPlaceTile extends HydratableAction<typeof PlaceTile> implements PlaceTile {
    declare type: ActionType.PlaceTile
    declare playerId: string
    declare cell: OffsetCoordinates
    declare rotation: number
    declare extraCubes: number
    declare metadata?: TilePlaced

    constructor(data: PlaceTile) {
        super(data, PlaceTileValidator)
    }

    apply(state: HydratedConduitGameState) {
        const placement = state.pendingPlacement()
        assertExists(placement, 'A tile is waiting to be placed')
        const extraPrice = state.placeTile(this.playerId, this.cell, this.rotation, this.extraCubes)
        this.metadata = {
            tileId: placement.tileId,
            faceUp: placement.faceUp,
            ...(extraPrice > 0 ? { extraPrice } : {})
        }
    }

    static canPlaceTile(state: HydratedConduitGameState, action: PlaceTile): boolean {
        const placement = state.pendingPlacement()
        if (placement?.playerId !== action.playerId) {
            return false
        }
        const face = {
            tileId: placement.tileId,
            rotation: action.rotation,
            faceUp: placement.faceUp
        }
        const player = state.getPlayerState(action.playerId)
        const cubesAllowed = placement.faceUp
            ? action.extraCubes <= player.supply &&
              action.extraCubes <= MaxExtraCubes &&
              extraCubesPrice(action.extraCubes) <= player.cash
            : action.extraCubes === 0
        return cubesAllowed && state.grid().isLegalPlacement(face, action.cell)
    }
}
