import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { PlacingPieceStateHandler } from '../stateHandlers/placingPiece.js'
import { ExploringStateHandler } from '../stateHandlers/exploring.js'
import { AttackingStateHandler } from '../stateHandlers/attacking.js'
import { ResolvingTechnologyStateHandler } from '../stateHandlers/resolvingTechnology.js'
import { PlacingTileStateHandler } from '../stateHandlers/placingTile.js'
import { DraftingPiecesStateHandler } from '../stateHandlers/draftingPieces.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { PlacingBonusPieceStateHandler } from '../stateHandlers/placingBonusPiece.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const EarendelStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedEarendelGameState>
> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.DraftingPieces]: new DraftingPiecesStateHandler(),
    [MachineState.PlacingPiece]: new PlacingPieceStateHandler(),
    [MachineState.Exploring]: new ExploringStateHandler(),
    [MachineState.Attacking]: new AttackingStateHandler(),
    [MachineState.ResolvingTechnology]: new ResolvingTechnologyStateHandler(),
    [MachineState.PlacingTile]: new PlacingTileStateHandler(),
    [MachineState.PlacingBonusPiece]: new PlacingBonusPieceStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
