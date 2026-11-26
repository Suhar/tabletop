import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type RouteChosen = Type.Static<typeof RouteChosen>
export const RouteChosen = Type.Object({
    tolls: Type.Array(Type.String())
})

// Designer ruling, 2026-11-25.
export type ChooseRoute = Type.Static<typeof ChooseRoute>
export const ChooseRoute = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseRoute),
            playerId: Type.String(),
            tileId: Type.Integer(),
            route: Type.Array(OffsetCoordinates),
            metadata: Type.Optional(RouteChosen)
        })
    ])
)

export const ChooseRouteValidator = Compile(ChooseRoute)

export function isChooseRoute(action?: GameAction): action is ChooseRoute {
    return action?.type === ActionType.ChooseRoute
}

export class HydratedChooseRoute
    extends HydratableAction<typeof ChooseRoute>
    implements ChooseRoute
{
    declare type: ActionType.ChooseRoute
    declare playerId: string
    declare tileId: number
    declare route: OffsetCoordinates[]
    declare metadata?: RouteChosen

    constructor(data: ChooseRoute) {
        super(data, ChooseRouteValidator)
    }

    static canChooseRoute(state: HydratedConduitGameState, action: ChooseRoute): boolean {
        const choice = state.pendingRouteChoice()
        return (
            choice !== undefined &&
            choice.playerId === action.playerId &&
            choice.tileId === action.tileId &&
            state.routeOption(choice, action.route) !== undefined
        )
    }

    apply(state: HydratedConduitGameState) {
        const option = state.chooseRoute(this.playerId, this.tileId, this.route)
        this.metadata = { tolls: option.tolls }
    }
}
