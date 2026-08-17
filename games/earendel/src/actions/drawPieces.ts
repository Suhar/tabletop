import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { drawCountForPlayer } from '../util/turn.js'
import { claimRipeTechnologies } from '../util/technologyGrants.js'
import type { EarendelGameConfig } from '../definition/config.js'

export type DrawPiecesMetadata = Type.Static<typeof DrawPiecesMetadata>
export const DrawPiecesMetadata = Type.Object({
    drawn: Type.Optional(Type.Array(Piece)),
    // Technologies that became this player's as the turn opened, by having held their planets
    // outright since their last turn. Reported so history and the board can announce them:
    // unlike a placement's rewards, nobody was watching the moment these were earned.
    technologiesClaimed: Type.Optional(Type.Array(Type.String()))
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

        // Claimed BEFORE the ships are drawn, because this is the start-of-turn reckoning:
        // every planet this player has held outright since their last turn pays out now. It
        // happens here rather than in StartOfTurnStateHandler.enter for two reasons - enter()
        // cannot change the machine state, and an immediate effect has to be able to send the
        // turn somewhere - and it costs nothing in fidelity, since between a turn beginning
        // and its owner drawing, nobody else can act.
        const technologiesClaimed = claimRipeTechnologies(state, this.playerId)

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

        // More than one ship means a discard is owed. Recorded now, because the technologies
        // claimed above may send the turn through a tile or a move first, and what is in hand by
        // the time it comes back no longer says whether the draft has happened.
        state.draftPending = state.heldPieces.length > 1

        this.revealsInfo = state.heldPieces.length > 0
        this.metadata = {
            drawn: [...state.heldPieces],
            ...(technologiesClaimed.length > 0 ? { technologiesClaimed } : {})
        }
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
