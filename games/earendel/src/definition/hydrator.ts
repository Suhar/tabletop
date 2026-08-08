import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import { HydratedChooseTechnology, isChooseTechnology } from '../actions/chooseTechnology.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// This is essentially a factory that knows how to take raw action and state data
// and return the correct hydrated class instances for Earendel. Used by the game engine
export class EarendelHydrator
    implements GameHydrator<EarendelGameState, HydratedEarendelGameState>
{
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlacePiece(data): {
                return new HydratedPlacePiece(data)
            }
            case isChoosePlanet(data): {
                return new HydratedChoosePlanet(data)
            }
            case isChooseTechnology(data): {
                return new HydratedChooseTechnology(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: EarendelGameState): HydratedEarendelGameState {
        return new HydratedEarendelGameState(state)
    }
}
