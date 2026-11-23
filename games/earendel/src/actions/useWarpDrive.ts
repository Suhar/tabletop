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
import { warpDestinationsFrom } from '../util/movement.js'
import { ScoredChain } from '../model/chains.js'
import { claimChanges, ClaimChangeMetadata, snapshotClaims } from '../util/claimChanges.js'
import { StationComplexSummary } from '../model/stationComplex.js'

export type UseWarpDriveMetadata = Type.Static<typeof UseWarpDriveMetadata>
export const UseWarpDriveMetadata = Type.Object({
    ...ClaimChangeMetadata,
    pieceType: Type.Optional(Type.Enum(PieceType)),
    stationGroupPoints: Type.Optional(Type.Number()),
    stationComplex: Type.Optional(StationComplexSummary),
    chains: Type.Optional(Type.Array(ScoredChain)),
    probeDestinations: Type.Optional(Type.Array(AxialCoordinates))
})

export type UseWarpDrive = Type.Static<typeof UseWarpDrive>
export const UseWarpDrive = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseWarpDrive),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(UseWarpDriveMetadata)
        })
    ])
)

export const UseWarpDriveValidator = Compile(UseWarpDrive)

export function isUseWarpDrive(action?: GameAction): action is UseWarpDrive {
    return action?.type === ActionType.UseWarpDrive
}

// Warp Drive (rules.md, One-shot technologies): once, when its holder chooses, one of their
// pieces travels through any number of empty space hexes and counts as newly placed where it
// lands.
export class HydratedUseWarpDrive
    extends HydratableAction<typeof UseWarpDrive>
    implements UseWarpDrive
{
    declare type: ActionType.UseWarpDrive
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: UseWarpDriveMetadata

    constructor(data: UseWarpDrive) {
        super(data, UseWarpDriveValidator)
    }

    apply(state: HydratedEarendelGameState, _context?: MachineContext) {
        const invalidReason = this.invalidUseWarpDriveReason(state)
        if (invalidReason) {
            throw Error(`Invalid UseWarpDrive action: ${invalidReason}`)
        }

        const claims = snapshotClaims(state)

        const fromHex = state.board.hexes[hexKey(this.from)]
        const piece = fromHex.piece
        assertExists(piece, 'Warp Drive moves a piece of yours')

        delete fromHex.piece
        delete piece.surveying
        state.board.hexes[hexKey(this.to)].piece = piece

        state.getPlayerState(this.playerId).spendStoredEffect(TechnologyEffectKind.WarpDrive)

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

    isValidUseWarpDrive(state: HydratedEarendelGameState): boolean {
        return this.invalidUseWarpDriveReason(state) === undefined
    }

    invalidUseWarpDriveReason(state: HydratedEarendelGameState): string | undefined {
        if (!state.activePlayerIds.includes(this.playerId)) return "It isn't your turn."

        if (state.pendingAttack) return 'A shot of yours is already waiting.'
        if (state.pendingExploration) return 'A planet of yours is still waiting to be explored.'

        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasStoredEffect(TechnologyEffectKind.WarpDrive)) {
            return 'You have no Warp Drive to use.'
        }

        const piece = getHex(state.board, this.from)?.piece
        if (!piece) return 'There is no piece there to move.'
        if (piece.playerId !== this.playerId) return "That piece isn't yours."

        if (
            !warpDestinationsFrom(state.board, this.from).some((option) =>
                sameCoordinates(option, this.to)
            )
        ) {
            return 'That piece cannot warp there: it must be empty open space, reached through empty space.'
        }

        return undefined
    }
}
