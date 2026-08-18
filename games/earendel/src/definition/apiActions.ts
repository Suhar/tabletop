import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { PlacePiece } from '../actions/placePiece.js'
import { ChooseTechnology } from '../actions/chooseTechnology.js'
import { ChoosePlanet } from '../actions/choosePlanet.js'
import { AttackPiece } from '../actions/attackPiece.js'
import { MovePiece } from '../actions/movePiece.js'
import { PlaceTile } from '../actions/placeTile.js'
import { DiscardPiece } from '../actions/discardPiece.js'
import { UseLogisticsUpgrade } from '../actions/useLogisticsUpgrade.js'
import { UseUpdatedLogistics } from '../actions/useUpdatedLogistics.js'
import { AttackSpread } from '../actions/attackSpread.js'
import { DrawPieces } from '../actions/drawPieces.js'


// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const EarendelApiActions = {
    [ActionType.DrawPieces]: DrawPieces,
    [ActionType.UseLogisticsUpgrade]: UseLogisticsUpgrade,
    [ActionType.UseUpdatedLogistics]: UseUpdatedLogistics,
    [ActionType.AttackSpread]: AttackSpread,
    [ActionType.DiscardPiece]: DiscardPiece,
    [ActionType.PlaceTile]: PlaceTile,
    [ActionType.MovePiece]: MovePiece,
    [ActionType.AttackPiece]: AttackPiece,
    [ActionType.ChooseTechnology]: ChooseTechnology,
    [ActionType.ChoosePlanet]: ChoosePlanet,
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.Pass]: Pass,
}
