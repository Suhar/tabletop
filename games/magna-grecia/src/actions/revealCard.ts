import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

export type RevealCard = Type.Static<typeof RevealCard>
export const RevealCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RevealCard),
            playerId: Type.String()
        })
    ])
)

export const RevealCardValidator = Compile(RevealCard)

export function isRevealCard(action?: GameAction): action is RevealCard {
    return action?.type === ActionType.RevealCard
}

export class HydratedRevealCard extends HydratableAction<typeof RevealCard> implements RevealCard {
    declare type: ActionType.RevealCard
    declare playerId: string

    constructor(data: RevealCard) {
        super(data, RevealCardValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        if (!HydratedRevealCard.canRevealCard(state, this.playerId)) {
            throw Error('Invalid RevealCard action')
        }
        state.revealCardsForRound()
        this.revealsInfo = true
    }

    static canRevealCard(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return (
            state.machineState === MachineState.RevealingCard &&
            state.awaitsCardReveal() &&
            state.isTurnOf(playerId)
        )
    }
}
