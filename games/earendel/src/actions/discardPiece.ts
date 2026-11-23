import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { earendelConfig } from '../definition/config.js'
import { keepCountForPlayer } from '../util/turn.js'
import { Piece, PieceType } from '../model/pieces.js'
import { returnToBag } from '../model/bags.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { ruleInForce } from '../util/rules.js'

export type DiscardPieceMetadata = Type.Static<typeof DiscardPieceMetadata>
export const DiscardPieceMetadata = Type.Object({
    discarded: Type.Optional(Piece),
    // Global Recycling, or Scrap: it went back into its owner's bag instead of out of the game.
    recycled: Type.Optional(Type.Boolean()),
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

    apply(state: HydratedEarendelGameState, context?: MachineContext) {
        const invalidReason = this.invalidDiscardPieceReason(state, context)
        if (invalidReason) {
            throw Error(`Invalid DiscardPiece action: ${invalidReason}`)
        }

        if (!this.pieceId) {
            // Nothing to throw out: the draft is done.
            state.draftPending = false
            this.metadata = { nothingToDiscard: true }
            return
        }

        const index = state.heldPieces.findIndex((piece) => piece.id === this.pieceId)
        const [discarded] = state.heldPieces.splice(index, 1)
        // A Deep Scanner's extra ship means a second discard before the draft is done.
        state.draftPending =
            state.heldPieces.length >
            keepCountForPlayer(state, this.playerId, earendelConfig(context?.gameConfig))

        // Global Recycling: the thrown-out ship is shuffled back into the bag it came from, as
        // Scrap always is (rules.md, One-shot technologies).
        const recycled =
            discarded.type === PieceType.Scrap ||
            ruleInForce(state.board, TechnologyEffectKind.Reinforcements)
        if (recycled) {
            returnToBag(
                state.getPlayerState(this.playerId).bag,
                [discarded],
                state.getProtectedPrng().random
            )
        }

        if (!recycled) {
            state.discardedThisTurn = [...(state.discardedThisTurn ?? []), discarded]
        }

        this.metadata = { discarded, ...(recycled ? { recycled } : {}) }
    }

    isValidDiscardPiece(state: HydratedEarendelGameState, context?: MachineContext): boolean {
        return this.invalidDiscardPieceReason(state, context) === undefined
    }

    invalidDiscardPieceReason(
        state: HydratedEarendelGameState,
        context?: MachineContext
    ): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        const keep = keepCountForPlayer(state, this.playerId, earendelConfig(context?.gameConfig))
        if (state.heldPieces.length <= keep) {
            return this.pieceId ? 'There is nothing to discard.' : undefined
        }

        if (!this.pieceId) return 'No ship was chosen to discard.'
        if (!state.heldPieces.some((piece) => piece.id === this.pieceId)) {
            return "That ship isn't one of the ones you drew."
        }
        return undefined
    }
}
