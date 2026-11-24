import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedEarendelGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getHex, hexKey } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { resolveArrival } from '../util/arrival.js'
import { destinationsFrom } from '../util/movement.js'
import {
    snapshotStanding,
    standingChanges,
    StandingChangeMetadata
} from '../util/standingChanges.js'
import { StationComplexSummary } from '../model/stationComplex.js'

export type UseTacticalShiftMetadata = Type.Static<typeof UseTacticalShiftMetadata>
export const UseTacticalShiftMetadata = Type.Object({
    ...StandingChangeMetadata,
    pieceType: Type.Optional(Type.Enum(PieceType)),
    stationGroupPoints: Type.Optional(Type.Number()),
    stationComplex: Type.Optional(StationComplexSummary),
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type UseTacticalShift = Type.Static<typeof UseTacticalShift>
export const UseTacticalShift = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseTacticalShift),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseTacticalShiftMetadata)
        })
    ])
)

export const UseTacticalShiftValidator = Compile(UseTacticalShift)

export function isUseTacticalShift(action?: GameAction): action is UseTacticalShift {
    return action?.type === ActionType.UseTacticalShift
}

// Tactical Shift (rules.md, Stored technologies): once, when its holder chooses, one of their
// pieces steps into an adjacent empty space and counts as newly placed there.
export class HydratedUseTacticalShift
    extends HydratableAction<typeof UseTacticalShift>
    implements UseTacticalShift
{
    declare type: ActionType.UseTacticalShift
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseTacticalShiftMetadata

    constructor(data: UseTacticalShift) {
        super(data, UseTacticalShiftValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseTacticalShiftReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseTacticalShift action: ${invalidReason}`)
        }

        const claims = snapshotStanding(state)

        const fromHex = state.board.hexes[hexKey(this.from)]
        const piece = fromHex.piece
        assertExists(piece, 'Tactical Shift moves a piece of yours')

        delete fromHex.piece
        delete piece.surveying
        state.board.hexes[hexKey(this.to)].piece = piece

        state
            .getPlayerState(this.playerId)
            .spendStoredEffect(TechnologyEffectKind.MoveFriendlyPiece)

        const { stationPoints, complex, probeDestinations } = resolveArrival(
            state,
            this.playerId,
            this.to
        )

        this.metadata = {
            pieceType: piece.type,
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(stationPoints > 0 && complex ? { stationComplex: complex } : {}),
            ...(probeDestinations.length > 0 ? { probeDestinations } : {})
        }
        this.metadata = { ...this.metadata, ...standingChanges(claims, state) }
    }

    isValidUseTacticalShift(state: HydratedEarendelGameState): boolean {
        return this.invalidUseTacticalShiftReason(state) === undefined
    }

    invalidUseTacticalShiftReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.MoveFriendlyPiece)) {
            return 'You have no Tactical Shift to use.'
        }

        const piece = getHex(state.board, this.from)?.piece
        if (!piece) return 'There is no piece there to move.'
        if (piece.playerId !== this.playerId) return "That piece isn't yours."

        if (
            !destinationsFrom(state.board, this.from).some((option) =>
                sameCoordinates(option, this.to)
            )
        ) {
            return 'That piece cannot step there: it must be adjacent, empty open space.'
        }

        return undefined
    }
}
