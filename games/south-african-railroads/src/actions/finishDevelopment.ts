import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type FinishDevelopment = Type.Static<typeof FinishDevelopment>
export const FinishDevelopment = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishDevelopment),
            playerId: Type.String()
        })
    ])
)

export const FinishDevelopmentValidator = Compile(FinishDevelopment)

export function isFinishDevelopment(action?: GameAction): action is FinishDevelopment {
    return action?.type === ActionType.FinishDevelopment
}

export class HydratedFinishDevelopment
    extends HydratableAction<typeof FinishDevelopment>
    implements FinishDevelopment
{
    declare type: ActionType.FinishDevelopment
    declare playerId: string

    constructor(data: FinishDevelopment) {
        super(data, FinishDevelopmentValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(state.mayFinishDeveloping(), 'Johannesburg takes the second development')
    }

    static canFinish(state: HydratedSarGameState): boolean {
        return state.mayFinishDeveloping()
    }
}
