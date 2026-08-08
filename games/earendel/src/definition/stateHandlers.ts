import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'

// The mapping of machine states to their handlers for the Sample game, used by the game engine
export const EarendelStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedEarendelGameState>
> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler()
}
