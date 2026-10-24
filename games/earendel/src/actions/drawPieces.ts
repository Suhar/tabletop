import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { drawCountForPlayer } from '../util/turn.js'
import { claimProbeTechnologies } from '../util/technologyGrants.js'
import { refreshPlanetControl } from '../util/control.js'
import { earendelConfig } from '../definition/config.js'

export type DrawPiecesMetadata = Type.Static<typeof DrawPiecesMetadata>
export const DrawPiecesMetadata = Type.Object({
    drawn: Type.Optional(Type.Array(Piece)),
    technologiesClaimed: Type.Optional(Type.Array(Type.String())),
    technologiesLapsed: Type.Optional(Type.Array(Type.String()))
})

export type DrawPieces = Type.Static<typeof DrawPieces>
export const DrawPieces = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DrawPieces),
            playerId: Type.String(),
            // Drawn ships become public, so undo cannot reach back past the draw.
            revealsInfo: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(DrawPiecesMetadata)
        })
    ])
)

export const DrawPiecesValidator = Compile(DrawPieces)

export function isDrawPieces(action?: GameAction): action is DrawPieces {
    return action?.type === ActionType.DrawPieces
}

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

        // Claimed here rather than in StartOfTurnStateHandler.enter: enter() cannot change the
        // machine state, and an immediate effect may have to redirect the turn.
        refreshPlanetControl(state)

        const { gained: technologiesClaimed, lapsed: technologiesLapsed } = claimProbeTechnologies(
            state,
            this.playerId
        )

        const playerState = state.getPlayerState(this.playerId)
        const wanted = drawCountForPlayer(state, this.playerId, earendelConfig(context?.gameConfig))

        state.heldPieces = []
        for (let drawn = 0; drawn < wanted; drawn++) {
            const piece = playerState.drawFromBag()
            if (!piece) break
            state.heldPieces.push(piece)
        }

        // Recorded now: claimed technologies may detour the turn before the discard.
        state.draftPending = state.heldPieces.length > 1

        this.revealsInfo = state.heldPieces.length > 0 || state.pendingTile !== undefined
        this.metadata = {
            drawn: [...state.heldPieces],
            ...(technologiesClaimed.length > 0 ? { technologiesClaimed } : {}),
            ...(technologiesLapsed.length > 0 ? { technologiesLapsed } : {})
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
