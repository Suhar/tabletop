import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { PlacePiece } from '../actions/placePiece.js'


// Define the mapping of action type names to their actual types.
// This is used by the backend to auto generate endpoints for every action with schema validation
export const EarendelApiActions = {
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.Pass]: Pass,
}
