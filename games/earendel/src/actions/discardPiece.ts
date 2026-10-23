import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'

export type DiscardPieceMetadata = Type.Static<typeof DiscardPieceMetadata>
export const DiscardPieceMetadata = Type.Object({
    discarded: Type.Optional(Piece),
    nothingToDiscard: Type.Optional(Type.Boolean())
})

export type DiscardPiece = Type.Static<typeof DiscardPiece>
export const DiscardPiece = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DiscardPiece),
            playerId: Type.String(),
            pieceId: Type.Optional(Type.String()),
            metadata: Type.Optional(DiscardPieceMetadata)
        })
    ])
)

export const DiscardPieceValidator = Compile(DiscardPiece)

export function isDiscardPiece(action?: GameAction): action is DiscardPiece {
    return action?.type === ActionType.DiscardPiece
}

export class HydratedDiscardPiece
    extends HydratableAction<typeof DiscardPiece>
    implements DiscardPiece
{
    declare type: ActionType.DiscardPiece
    declare playerId: string
    declare pieceId?: string
    declare metadata?: DiscardPieceMetadata

    constructor(data: DiscardPiece) {
        super(data, DiscardPieceValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidDiscardPieceReason(state)
        if (invalidReason) {
            throw Error(`Invalid DiscardPiece action: ${invalidReason}`)
        }

        if (!this.pieceId) {
            this.metadata = { nothingToDiscard: true }
            return
        }

        const index = state.heldPieces.findIndex((piece) => piece.id === this.pieceId)
        const [discarded] = state.heldPieces.splice(index, 1)
        state.draftPending = false

        this.metadata = { discarded }
    }

    isValidDiscardPiece(state: HydratedEarendelGameState): boolean {
        return this.invalidDiscardPieceReason(state) === undefined
    }

    invalidDiscardPieceReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.heldPieces.length <= 1) {
            return this.pieceId ? 'There is nothing to discard.' : undefined
        }

        if (!this.pieceId) return 'No ship was chosen to discard.'
        if (!state.heldPieces.some((piece) => piece.id === this.pieceId)) {
            return "That ship isn't one of the ones you drew."
        }
        return undefined
    }
}
