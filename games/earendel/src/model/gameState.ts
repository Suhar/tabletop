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

export type EarendelGameState = Type.Static<typeof EarendelGameState>
export const EarendelGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(EarendelPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            board: EarendelBoard
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
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: EarendelGameState) {
        super(data, EarendelGameStateValidator)

        this.players = data.players.map((player) => new HydratedEarendelPlayerState(player))
    }
}
