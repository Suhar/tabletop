import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { drawCountForPlayer } from '../util/turn.js'
import type { EarendelGameConfig } from '../definition/config.js'

export type DrawPiecesMetadata = Type.Static<typeof DrawPiecesMetadata>
export const DrawPiecesMetadata = Type.Object({
    drawn: Type.Optional(Type.Array(Piece))
})

export type DrawPieces = Type.Static<typeof DrawPieces>
export const DrawPieces = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DrawPieces),
            playerId: Type.String(),
            // Turning ships face up is the moment hidden information becomes public, so undo
            // cannot reach back past it. That is what gives the previous player a window to
            // take their turn back: it closes when the next player draws, and not before.
            //
            // Set from what was actually drawn - an empty bag reveals nothing.
            revealsInfo: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(DrawPiecesMetadata)
        })
    ])
)

export const DrawPiecesValidator = Compile(DrawPieces)

export function isDrawPieces(action?: GameAction): action is DrawPieces {
    return action?.type === ActionType.DrawPieces
}

// Opens a turn by drawing the turn's ships. A deliberate action rather than something that
// happens on its own, so that nothing is revealed until the player whose turn it is asks for
// it - and so the player before them still has time to change their mind.
export class HydratedDrawPieces extends HydratableAction<typeof DrawPieces> implements DrawPieces {
    declare type: ActionType.DrawPieces
    declare playerId: string
    declare revealsInfo?: boolean
    declare metadata?: DrawPiecesMetadata

    constructor(data: DrawPieces) {
        super(data, DrawPiecesValidator)
    }

    apply(state: HydratedEarendelGameState, context?: MachineContext) {
        const invalidReason = this.invalidDrawPiecesReason(state)
        if (invalidReason) {
            throw Error(`Invalid DrawPieces action: ${invalidReason}`)
        }

        const playerState = state.getPlayerState(this.playerId)
        const wanted = drawCountForPlayer(
            state,
            this.playerId,
            context?.gameConfig as EarendelGameConfig
        )

        state.heldPieces = []
        for (let drawn = 0; drawn < wanted; drawn++) {
            const piece = playerState.drawFromBag()
            if (!piece) break
            state.heldPieces.push(piece)
        }

        this.revealsInfo = state.heldPieces.length > 0
        this.metadata = { drawn: [...state.heldPieces] }
    }

    isValidDrawPieces(state: HydratedEarendelGameState): boolean {
        return this.invalidDrawPiecesReason(state) === undefined
    }

    invalidDrawPiecesReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."
        if (state.heldPieces.length > 0) return 'You have already drawn this turn.'
        return undefined
    }
}
