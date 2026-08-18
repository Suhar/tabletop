import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { EarendelPlayerState, HydratedEarendelPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { EarendelBoard } from './board.js'
import { Piece } from './pieces.js'
import { TechnologyCard } from './technology.js'
import { PendingExploration, PendingTechnology } from './exploration.js'
import { Tile } from './tile.js'
import { PendingAttack } from './attack.js'

export type EarendelGameState = Type.Static<typeof EarendelGameState>
export const EarendelGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(EarendelPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            board: EarendelBoard,
            // The shared technology deck, in draw order, and its discard. Both are hidden
            // information: the deck's order is what exploring reveals, so anything exposing
            // state to a player must keep it that way (and initializeExplorationState has to
            // reshuffle it).
            technologyDeck: Type.Array(TechnologyCard),
            technologyDiscard: Type.Array(TechnologyCard),
            // Set while a probe placement is waiting on its player: which planet to explore
            // (when it reached more than one), and then which revealed technology to keep.
            // Cleared once the exploration resolves. Its presence is what holds the turn open.
            pendingExploration: Type.Optional(PendingExploration),
            // The ships drawn for the current turn and not yet placed. Drawn before any hex
            // is chosen, because knowing what you have is what makes the placement a
            // decision. Public: the platform sends state to every client whole, so there is
            // nowhere to hide it.
            //
            // One piece in the simple turn style, two after a draft, and briefly three while
            // the player decides which to throw away. The turn ends when it empties, which is
            // what lets both styles share one path.
            heldPieces: Type.Array(Piece),
            // Tiles held back from the starting map, drawn by the technology that grows the
            // board.
            tileSupply: Type.Array(Tile),
            // A tile drawn and waiting to be laid.
            pendingTile: Type.Optional(
                Type.Object({ playerId: Type.String(), tile: Tile })
            ),
            // Set between laying a tile and placing the ship that follows it: that ship, and
            // only that ship, must land on this tile. The piece is named as well as the tile
            // because a drafted turn may still be holding a piece of its own.
            bonusPlacementTileId: Type.Optional(Type.String()),
            bonusPlacementPieceId: Type.Optional(Type.String()),
            // Set while an immediate technology effect is owed to the player who claimed it.
            pendingTechnology: Type.Optional(PendingTechnology),
            // Immediate effects still owed after the one being resolved. A turn can claim
            // several technologies at once - two planets held to term on the same turn - and
            // each one that acts at once has to be carried out before the turn proceeds. The
            // one in hand lives in pendingTechnology/pendingTile as it always has; this is the
            // rest of the line behind it, drained one at a time.
            queuedTechnologyEffects: Type.Array(PendingTechnology),
            // Whether this turn still owes its draft discard. The count in hand can't answer
            // that on its own: a turn that lays a tile draws an extra ship for it, so "more than
            // one held" stops meaning "hasn't discarded yet" the moment a technology intervenes.
            draftPending: Type.Optional(Type.Boolean()),
            // Who controls each planet, by hex key. Recorded rather than derived because control
            // is STICKY: a tie leaves the incumbent in place, so the answer depends on who held it
            // before and cannot be read off the board alone (see util/control.ts).
            planetControllers: Type.Record(Type.String(), Type.String()),
            // Set while a newly placed fighter's owner decides whether to fire. Like
            // pendingExploration, its presence is what holds the turn open.
            pendingAttack: Type.Optional(PendingAttack),
            // Pairs of planets already joined by a chain (see planetPairKey). A pair pays
            // out once and is then spent for everyone, so the record is global rather than
            // per player - joining a colour first is the whole race.
            scoredPlanetPairs: Type.Array(Type.String())
        })
    ])
)

const EarendelGameStateValidator = Compile(EarendelGameState)

export class HydratedEarendelGameState
    extends HydratableGameState<typeof EarendelGameState, HydratedEarendelPlayerState>
    implements EarendelGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
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
    declare technologyDeck: TechnologyCard[]
    declare technologyDiscard: TechnologyCard[]
    declare pendingExploration?: PendingExploration
    declare heldPieces: Piece[]
    declare pendingAttack?: PendingAttack
    declare pendingTechnology?: PendingTechnology
    declare queuedTechnologyEffects: PendingTechnology[]
    declare draftPending?: boolean
    declare planetControllers: Record<string, string>
    declare tileSupply: Tile[]
    declare pendingTile?: { playerId: string; tile: Tile }
    declare bonusPlacementTileId?: string
    declare bonusPlacementPieceId?: string
    declare scoredPlanetPairs: string[]
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: EarendelGameState) {
        super(data, EarendelGameStateValidator)

        this.players = data.players.map((player) => new HydratedEarendelPlayerState(player))
    }
}
