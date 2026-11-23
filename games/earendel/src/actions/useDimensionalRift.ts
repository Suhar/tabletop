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
import { riftDestinationsFrom } from '../util/movement.js'
import { ScoredChain } from '../model/chains.js'
import { claimChanges, ClaimChangeMetadata, snapshotClaims } from '../util/claimChanges.js'
import { StationComplexSummary } from '../model/stationComplex.js'

export type UseDimensionalRiftMetadata = Type.Static<typeof UseDimensionalRiftMetadata>
export const UseDimensionalRiftMetadata = Type.Object({
    ...ClaimChangeMetadata,
    pieceType: Type.Optional(Type.Enum(PieceType)),
    stationGroupPoints: Type.Optional(Type.Number()),
    stationComplex: Type.Optional(StationComplexSummary),
    chains: Type.Optional(Type.Array(ScoredChain)),
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type UseDimensionalRift = Type.Static<typeof UseDimensionalRift>
export const UseDimensionalRift = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseDimensionalRift),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseDimensionalRiftMetadata)
        })
    ])
)

export const UseDimensionalRiftValidator = Compile(UseDimensionalRift)

export function isUseDimensionalRift(action?: GameAction): action is UseDimensionalRift {
    return action?.type === ActionType.UseDimensionalRift
}

// Dimensional Rift (rules.md, One-shot technologies): once, when its holder chooses, one of
// their pieces on the outer border of the map leaves it and comes out on another empty border
// hex, where it counts as newly placed.
export class HydratedUseDimensionalRift
    extends HydratableAction<typeof UseDimensionalRift>
    implements UseDimensionalRift
{
    declare type: ActionType.UseDimensionalRift
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseDimensionalRiftMetadata

    constructor(data: UseDimensionalRift) {
        super(data, UseDimensionalRiftValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseDimensionalRiftReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseDimensionalRift action: ${invalidReason}`)
        }

        const claims = snapshotClaims(state)

        const fromHex = state.board.hexes[hexKey(this.from)]
        const piece = fromHex.piece
        assertExists(piece, 'Dimensional Rift moves a piece of yours')

        delete fromHex.piece
        delete piece.surveying
        state.board.hexes[hexKey(this.to)].piece = piece

        state.getPlayerState(this.playerId).spendStoredEffect(TechnologyEffectKind.DimensionalRift)

        const { stationPoints, complex, chains, probeDestinations } = resolveArrival(
            state,
            this.playerId,
            this.to
        )

        this.metadata = {
            pieceType: piece.type,
            ...(stationPoints > 0 ? { stationGroupPoints: stationPoints } : {}),
            ...(stationPoints > 0 && complex ? { stationComplex: complex } : {}),
            ...(chains.length > 0
                ? { chains: chains.map(({ pairKey: _pairKey, ...chain }) => chain) }
                : {}),
            ...(probeDestinations.length > 0 ? { probeDestinations } : {})
        }
        this.metadata = { ...this.metadata, ...claimChanges(claims, state) }
    }

    isValidUseDimensionalRift(state: HydratedEarendelGameState): boolean {
        return this.invalidUseDimensionalRiftReason(state) === undefined
    }

    invalidUseDimensionalRiftReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.DimensionalRift)) {
            return 'You have no Dimensional Rift to use.'
        }

        const piece = getHex(state.board, this.from)?.piece
        if (!piece) return 'There is no piece there to move.'
        if (piece.playerId !== this.playerId) return "That piece isn't yours."

        if (
            !riftDestinationsFrom(state.board, this.from).some((option) =>
                sameCoordinates(option, this.to)
            )
        ) {
            return 'A Dimensional Rift runs from a piece on the border of the map to an empty border hex open to it.'
        }

        return undefined
    }
}
