import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import { HydratedChooseTechnology, isChooseTechnology } from '../actions/chooseTechnology.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedAttackPiece, isAttackPiece } from '../actions/attackPiece.js'
import { HydratedMovePiece, isMovePiece } from '../actions/movePiece.js'
import { HydratedPlaceTile, isPlaceTile } from '../actions/placeTile.js'
import { HydratedDiscardPiece, isDiscardPiece } from '../actions/discardPiece.js'
import { HydratedDrawPieces, isDrawPieces } from '../actions/drawPieces.js'
import { HydratedAttackSpread, isAttackSpread } from '../actions/attackSpread.js'
import { HydratedUseTacticalFeint, isUseTacticalFeint } from '../actions/useTacticalFeint.js'
import {
    HydratedUseTradeRouteWormhole,
    isUseTradeRouteWormhole
} from '../actions/useTradeRouteWormhole.js'
import {
    HydratedUseImmediateDownload,
    isUseImmediateDownload
} from '../actions/useImmediateDownload.js'
import {
    HydratedUseUpdatedLogistics,
    isUseUpdatedLogistics
} from '../actions/useUpdatedLogistics.js'
import {
    HydratedUseLogisticsUpgrade,
    isUseLogisticsUpgrade
} from '../actions/useLogisticsUpgrade.js'

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
            case isAttackSpread(data): {
                return new HydratedAttackSpread(data)
            }
            case isUseTacticalFeint(data): {
                return new HydratedUseTacticalFeint(data)
            }
            case isUseTradeRouteWormhole(data): {
                return new HydratedUseTradeRouteWormhole(data)
            }
            case isUseImmediateDownload(data): {
                return new HydratedUseImmediateDownload(data)
            }
            case isUseUpdatedLogistics(data): {
                return new HydratedUseUpdatedLogistics(data)
            }
            case isUseLogisticsUpgrade(data): {
                return new HydratedUseLogisticsUpgrade(data)
            }
            case isDrawPieces(data): {
                return new HydratedDrawPieces(data)
            }
            case isDiscardPiece(data): {
                return new HydratedDiscardPiece(data)
            }
            case isPlaceTile(data): {
                return new HydratedPlaceTile(data)
            }
            case isMovePiece(data): {
                return new HydratedMovePiece(data)
            }
            case isAttackPiece(data): {
                return new HydratedAttackPiece(data)
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
