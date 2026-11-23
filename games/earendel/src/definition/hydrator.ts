import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedEarendelGameState, EarendelGameState } from '../model/gameState.js'
import { HydratedPlacePiece, isPlacePiece } from '../actions/placePiece.js'
import { HydratedChoosePlanet, isChoosePlanet } from '../actions/choosePlanet.js'
import { HydratedChooseTechnology, isChooseTechnology } from '../actions/chooseTechnology.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedPlayScrap, isPlayScrap } from '../actions/playScrap.js'
import { HydratedUseConscription, isUseConscription } from '../actions/useConscription.js'
import { HydratedUseColonyShip, isUseColonyShip } from '../actions/useColonyShip.js'
import { HydratedUseFactoryOverride, isUseFactoryOverride } from '../actions/useFactoryOverride.js'
import { HydratedUseWarpDrive, isUseWarpDrive } from '../actions/useWarpDrive.js'
import { HydratedUseDimensionalRift, isUseDimensionalRift } from '../actions/useDimensionalRift.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedTerraform, isTerraform } from '../actions/terraform.js'
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
import { HydratedChooseEventOrder, isChooseEventOrder } from '../actions/chooseEventOrder.js'
import { HydratedEventPick, isEventPick } from '../actions/eventPick.js'
import { HydratedSeedNebula, isSeedNebula } from '../actions/seedNebula.js'
import { HydratedFoundPlanet, isFoundPlanet } from '../actions/foundPlanet.js'
import { HydratedStowShip, isStowShip } from '../actions/stowShip.js'
import { HydratedUseSpoofedOrders, isUseSpoofedOrders } from '../actions/useSpoofedOrders.js'
import { HydratedUseAsteroidField, isUseAsteroidField } from '../actions/useAsteroidField.js'
import { HydratedUseSecurityBreach, isUseSecurityBreach } from '../actions/useSecurityBreach.js'
import { HydratedUseTacticalShift, isUseTacticalShift } from '../actions/useTacticalShift.js'
import {
    HydratedUseBeyondTheFrontier,
    isUseBeyondTheFrontier
} from '../actions/useBeyondTheFrontier.js'
import {
    HydratedUseLogisticsUpgrade,
    isUseLogisticsUpgrade
} from '../actions/useLogisticsUpgrade.js'

export class EarendelHydrator implements GameHydrator<
    EarendelGameState,
    HydratedEarendelGameState
> {
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
            case isChooseEventOrder(data): {
                return new HydratedChooseEventOrder(data)
            }
            case isEventPick(data): {
                return new HydratedEventPick(data)
            }
            case isSeedNebula(data): {
                return new HydratedSeedNebula(data)
            }
            case isFoundPlanet(data): {
                return new HydratedFoundPlanet(data)
            }
            case isStowShip(data): {
                return new HydratedStowShip(data)
            }
            case isUseTacticalShift(data): {
                return new HydratedUseTacticalShift(data)
            }
            case isUseBeyondTheFrontier(data): {
                return new HydratedUseBeyondTheFrontier(data)
            }
            case isUseSpoofedOrders(data): {
                return new HydratedUseSpoofedOrders(data)
            }
            case isUseAsteroidField(data): {
                return new HydratedUseAsteroidField(data)
            }
            case isUseSecurityBreach(data): {
                return new HydratedUseSecurityBreach(data)
            }
            case isAttackPiece(data): {
                return new HydratedAttackPiece(data)
            }
            case isUseDimensionalRift(data): {
                return new HydratedUseDimensionalRift(data)
            }
            case isUseWarpDrive(data): {
                return new HydratedUseWarpDrive(data)
            }
            case isUseFactoryOverride(data): {
                return new HydratedUseFactoryOverride(data)
            }
            case isUseColonyShip(data): {
                return new HydratedUseColonyShip(data)
            }
            case isUseConscription(data): {
                return new HydratedUseConscription(data)
            }
            case isPlayScrap(data): {
                return new HydratedPlayScrap(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            case isEndTurn(data): {
                return new HydratedEndTurn(data)
            }
            case isTerraform(data): {
                return new HydratedTerraform(data)
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
