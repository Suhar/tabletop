import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, shuffle } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({
})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.Pass), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(PassMetadata) // Always optional, because it is an output
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: PassMetadata

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        if (!this.isValidPass(state)) {
            throw Error('Invalid Pass action')
        }

        // A turn that places nothing must still put its draw back, or the piece simply
        // vanishes - and the bag is the game's clock, so pieces quietly leaving it would
        // shorten the game for reasons no one could see.
        if (state.drawnPiece) {
            state.getPlayerState(this.playerId).bag.push(state.drawnPiece)
            shuffle(state.getPlayerState(this.playerId).bag, state.getPrng().random)
            state.drawnPiece = undefined
        }

        this.metadata = {}
    }

    isValidPass(_state: HydratedEarendelGameState): boolean {
        return true
    }
}
