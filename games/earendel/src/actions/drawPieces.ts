import * as Type from 'typebox'
import { controlsEveryColor, FIVE_COLOR_POINTS } from '../util/routePowers.js'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Piece } from '../model/pieces.js'
import { OrbitedProbe } from '../model/exploration.js'
import { drawCountForPlayer, keepCountForPlayer } from '../util/turn.js'
import { claimProbeTechnologies } from '../util/technologyGrants.js'
import { refreshStanding } from '../util/standing.js'
import { earendelConfig } from '../definition/config.js'
import {
    snapshotStanding,
    standingChanges,
    StandingChangeMetadata
} from '../util/standingChanges.js'

export type DrawPiecesMetadata = Type.Static<typeof DrawPiecesMetadata>
export const DrawPiecesMetadata = Type.Object({
    ...StandingChangeMetadata,
    drawn: Type.Optional(Type.Array(Piece)),
    // Paid for controlling a planet of every color (rules.md, What control is for).
    fiveColorPoints: Type.Optional(Type.Number()),
    technologiesClaimed: Type.Optional(Type.Array(Type.String())),
    technologiesLapsed: Type.Optional(Type.Array(Type.String())),
    orbited: Type.Optional(Type.Array(OrbitedProbe)),
    // Shared Science: rivals with a probe beside a paid planet who gained its technology too.
    shared: Type.Optional(
        Type.Array(Type.Object({ playerId: Type.String(), technologyId: Type.String() }))
    )
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

        const claims = snapshotStanding(state)

        // Claimed here rather than in StartOfTurnStateHandler.enter: enter() cannot change the
        // machine state, and an immediate effect may have to redirect the turn.
        refreshStanding(state)

        const {
            gained: technologiesClaimed,
            lapsed: technologiesLapsed,
            orbited,
            shared
        } = claimProbeTechnologies(state, this.playerId)

        const playerState = state.getPlayerState(this.playerId)
        const fiveColorPoints = controlsEveryColor(state, this.playerId) ? FIVE_COLOR_POINTS : 0
        playerState.score += fiveColorPoints
        const wanted = drawCountForPlayer(state, this.playerId, earendelConfig(context?.gameConfig))

        state.heldPieces = []
        for (let drawn = 0; drawn < wanted; drawn++) {
            const piece = playerState.drawFromBag()
            if (!piece) break
            state.heldPieces.push(piece)
        }

        // Recorded now: a drift step or a seeder may detour the turn before the discard. Under
        // Overdrive (rules.md, Elevated technologies) every drawn ship is placed.
        state.draftPending =
            state.heldPieces.length >
            keepCountForPlayer(state, this.playerId, earendelConfig(context?.gameConfig))

        this.revealsInfo = state.heldPieces.length > 0
        this.metadata = {
            drawn: [...state.heldPieces],
            ...(fiveColorPoints > 0 ? { fiveColorPoints } : {}),
            ...(technologiesClaimed.length > 0 ? { technologiesClaimed } : {}),
            ...(technologiesLapsed.length > 0 ? { technologiesLapsed } : {}),
            ...(orbited.length > 0 ? { orbited } : {}),
            ...(shared.length > 0 ? { shared } : {})
        }
        this.metadata = { ...this.metadata, ...standingChanges(claims, state) }
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
