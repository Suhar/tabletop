import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState, Payment } from '../model/gameState.js'

export type InfrastructureLost = Type.Static<typeof InfrastructureLost>
export const InfrastructureLost = Type.Object({
    flippedTileIds: Type.Array(Type.Integer()),
    refills: Type.Array(Payment),
    roundEnded: Type.Boolean()
})

export type LoseInfrastructure = Type.Static<typeof LoseInfrastructure>
export const LoseInfrastructure = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.LoseInfrastructure),
            metadata: Type.Optional(InfrastructureLost)
        })
    ])
)

export const LoseInfrastructureValidator = Compile(LoseInfrastructure)

export function isLoseInfrastructure(action?: GameAction): action is LoseInfrastructure {
    return action?.type === ActionType.LoseInfrastructure
}

export class HydratedLoseInfrastructure
    extends HydratableAction<typeof LoseInfrastructure>
    implements LoseInfrastructure
{
    declare type: ActionType.LoseInfrastructure
    declare metadata?: InfrastructureLost

    constructor(data: LoseInfrastructure) {
        super(data, LoseInfrastructureValidator)
    }

    // The payouts after the fifth round are not rounds of their own.
    apply(state: HydratedConduitGameState) {
        const flippedTileIds = state.loseInfrastructure()
        const roundEnded = state.roundManager.currentRound !== undefined
        const refills = roundEnded ? state.endRound() : []
        this.metadata = { flippedTileIds, refills, roundEnded }
    }
}
