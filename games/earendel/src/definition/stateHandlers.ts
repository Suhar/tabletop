import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import { ChoosingEventOrderStateHandler } from '../stateHandlers/choosingEventOrder.js'
import { ResolvingEventStateHandler } from '../stateHandlers/resolvingEvent.js'
import { SeedingStateHandler } from '../stateHandlers/seeding.js'
import { FoundingPlanetStateHandler } from '../stateHandlers/foundingPlanet.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { PlacingPieceStateHandler } from '../stateHandlers/placingPiece.js'
import { ExploringStateHandler } from '../stateHandlers/exploring.js'
import { AttackingStateHandler } from '../stateHandlers/attacking.js'
import { ResolvingTechnologyStateHandler } from '../stateHandlers/resolvingTechnology.js'
import { PlacingTileStateHandler } from '../stateHandlers/placingTile.js'
import { DraftingPiecesStateHandler } from '../stateHandlers/draftingPieces.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'
import { PlacingOpeningStationStateHandler } from '../stateHandlers/placingOpeningStation.js'
import { StowingShipStateHandler } from '../stateHandlers/stowingShip.js'
import { PlacingBonusPieceStateHandler } from '../stateHandlers/placingBonusPiece.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { EndingTurnStateHandler } from '../stateHandlers/endingTurn.js'
import { TerraformingStateHandler } from '../stateHandlers/terraforming.js'

export const EarendelStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedEarendelGameState>
> = {
    [MachineState.StowingShip]: new StowingShipStateHandler(),
    [MachineState.PlacingOpeningStation]: new PlacingOpeningStationStateHandler(),
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.DraftingPieces]: new DraftingPiecesStateHandler(),
    [MachineState.PlacingPiece]: new PlacingPieceStateHandler(),
    [MachineState.Exploring]: new ExploringStateHandler(),
    [MachineState.Attacking]: new AttackingStateHandler(),
    [MachineState.EndingTurn]: new EndingTurnStateHandler(),
    [MachineState.Terraforming]: new TerraformingStateHandler(),
    [MachineState.ResolvingTechnology]: new ResolvingTechnologyStateHandler(),
    [MachineState.PlacingTile]: new PlacingTileStateHandler(),
    [MachineState.PlacingBonusPiece]: new PlacingBonusPieceStateHandler(),
    [MachineState.ChoosingEventOrder]: new ChoosingEventOrderStateHandler(),
    [MachineState.ResolvingEvent]: new ResolvingEventStateHandler(),
    [MachineState.Seeding]: new SeedingStateHandler(),
    [MachineState.FoundingPlanet]: new FoundingPlanetStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
