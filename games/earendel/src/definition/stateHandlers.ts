import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { PlacingPieceStateHandler } from '../stateHandlers/placingPiece.js'
import { ExploringStateHandler } from '../stateHandlers/exploring.js'
import { AttackingStateHandler } from '../stateHandlers/attacking.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

// The mapping of machine states to their handlers, used by the game engine
export const EarendelStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedEarendelGameState>
> = {
    [MachineState.PlacingPiece]: new PlacingPieceStateHandler(),
    [MachineState.Exploring]: new ExploringStateHandler(),
    [MachineState.Attacking]: new AttackingStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
