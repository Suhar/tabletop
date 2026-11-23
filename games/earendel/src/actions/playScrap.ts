import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PieceType } from '../model/pieces.js'

export type PlayScrap = Type.Static<typeof PlayScrap>
export const PlayScrap = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayScrap),
            playerId: Type.String(),
            pieceId: Type.String()
        })
    ])
)

export const PlayScrapValidator = Compile(PlayScrap)

export function isPlayScrap(action?: GameAction): action is PlayScrap {
    return action?.type === ActionType.PlayScrap
}

// Playing a Scrap from the hand (rules.md, One-shot technologies): it is spent in place of a
// ship and does nothing, but it is out of the bag for good.
export class HydratedPlayScrap extends HydratableAction<typeof PlayScrap> implements PlayScrap {
    declare type: ActionType.PlayScrap
    declare playerId: string
    declare pieceId: string

    constructor(data: PlayScrap) {
        super(data, PlayScrapValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidPlayScrapReason(state)
        if (invalidReason) {
            throw Error(`Invalid PlayScrap action: ${invalidReason}`)
        }

        state.heldPieces = state.heldPieces.filter((piece) => piece.id !== this.pieceId)
        // It was played as a drawn ship is: no special piece replaces the draw after it.
        state.shipPlacedThisTurn = true
    }

    isValidPlayScrap(state: HydratedEarendelGameState): boolean {
        return this.invalidPlayScrapReason(state) === undefined
    }

    invalidPlayScrapReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."
        const piece = state.heldPieces.find((held) => held.id === this.pieceId)
        if (piece?.type !== PieceType.Scrap) return "That isn't a Scrap in your hand."
        return undefined
    }
}
