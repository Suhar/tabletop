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
            // The ship drawn at the start of the current turn, waiting to be placed. Drawn
            // before the player chooses a hex, because knowing what you got is what makes
            // the placement a decision. Public: the platform sends state to every client
            // whole, so there is nowhere to hide it.
            drawnPiece: Type.Optional(Piece),
            // Set while an immediate technology effect is owed to the player who chose it.
            pendingTechnology: Type.Optional(PendingTechnology),
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
    declare drawnPiece?: Piece
    declare pendingAttack?: PendingAttack
    declare pendingTechnology?: PendingTechnology
    declare scoredPlanetPairs: string[]
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: EarendelGameState) {
        super(data, EarendelGameStateValidator)

        this.players = data.players.map((player) => new HydratedEarendelPlayerState(player))
    }
}
