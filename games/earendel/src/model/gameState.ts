import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility
} from '@tabletop/common'
import { EarendelPlayerState, HydratedEarendelPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { EarendelBoard } from './board.js'
import { Piece } from './pieces.js'
import {
    PendingExploration,
    PendingTechnology,
    PendingTerraform,
    ProbeClaim
} from './exploration.js'
import { Tile } from './tile.js'
import { HydratedTechnologyDeck, HydratedTileSupply, TechnologyDeck, TileSupply } from './bags.js'
import { PendingAttack } from './attack.js'
import { TradeRoute } from './chains.js'

export type EarendelGameState = Type.Static<typeof EarendelGameState>
export const EarendelGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(EarendelPlayerState),
            machineState: Type.Enum(MachineState),
            board: EarendelBoard,
            technologyDeck: TechnologyDeck,
            technologyDiscard: Type.Array(Type.String()),
            pendingExploration: Type.Optional(PendingExploration),
            heldPieces: Type.Array(Piece),
            tileSupply: TileSupply,
            pendingTile: Type.Optional(Type.Object({ playerId: Type.String(), tile: Tile })),
            bonusPlacementTileId: Type.Optional(Type.String()),
            bonusPlacementPieceId: Type.Optional(Type.String()),
            pendingTechnology: Type.Optional(PendingTechnology),
            queuedTechnologyEffects: Type.Array(PendingTechnology),
            // Stored, not derived: a laid tile draws an extra ship, so the hand size cannot say.
            draftPending: Type.Optional(Type.Boolean()),
            // Stored, not derived: control is sticky, so it depends on who held it before (rules.md,
            // Control and scoring).
            planetControllers: Type.Record(Type.String(), Type.String()),
            pendingAttack: Type.Optional(PendingAttack),
            pendingTerraform: Type.Optional(PendingTerraform),
            tradeRoutes: Type.Array(TradeRoute),
            probeClaims: Type.Array(ProbeClaim)
        })
    ])
)

export const EarendelGameStateValidator = Compile(EarendelGameState)

// Hidden piles emptied and protected random state neutralised; hydration accepts this too.
export const EarendelProjectedState = Visibility.createProjectionSchema(EarendelGameState)
export type EarendelProjectedState = Type.Static<typeof EarendelProjectedState>
export const EarendelProjectedStateValidator = Compile(EarendelProjectedState)

export class HydratedEarendelGameState
    extends HydratableGameState<typeof EarendelProjectedState, HydratedEarendelPlayerState>
    implements EarendelProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedEarendelPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare board: EarendelBoard
    declare technologyDeck: HydratedTechnologyDeck
    declare technologyDiscard: string[]
    declare pendingExploration?: PendingExploration
    declare heldPieces: Piece[]
    declare pendingAttack?: PendingAttack
    declare pendingTerraform?: PendingTerraform
    declare pendingTechnology?: PendingTechnology
    declare queuedTechnologyEffects: PendingTechnology[]
    declare draftPending?: boolean
    declare planetControllers: Record<string, string>
    declare tileSupply: HydratedTileSupply
    declare pendingTile?: { playerId: string; tile: Tile }
    declare bonusPlacementTileId?: string
    declare bonusPlacementPieceId?: string
    declare tradeRoutes: TradeRoute[]
    declare probeClaims: ProbeClaim[]
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: EarendelProjectedState) {
        super(data, EarendelProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedEarendelPlayerState(player))
        this.technologyDeck = new HydratedTechnologyDeck(data.technologyDeck)
        this.tileSupply = new HydratedTileSupply(data.tileSupply)
    }
}
