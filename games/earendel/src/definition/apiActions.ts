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
import { UseTacticalFeint } from '../actions/useTacticalFeint.js'
import { UseTradeRouteWormhole } from '../actions/useTradeRouteWormhole.js'
import { UseImmediateDownload } from '../actions/useImmediateDownload.js'
import { AttackSpread } from '../actions/attackSpread.js'
import { DrawPieces } from '../actions/drawPieces.js'
import { EndTurn } from '../actions/endTurn.js'
import { Terraform } from '../actions/terraform.js'
import { ChooseEventOrder } from '../actions/chooseEventOrder.js'
import { EventPick } from '../actions/eventPick.js'
import { SeedNebula } from '../actions/seedNebula.js'
import { FoundPlanet } from '../actions/foundPlanet.js'
import { StowShip } from '../actions/stowShip.js'
import { UseTacticalShift } from '../actions/useTacticalShift.js'
import { UseBeyondTheFrontier } from '../actions/useBeyondTheFrontier.js'
import { UseSpoofedOrders } from '../actions/useSpoofedOrders.js'
import { UseAsteroidField } from '../actions/useAsteroidField.js'
import { UseSecurityBreach } from '../actions/useSecurityBreach.js'
import { PlayScrap } from '../actions/playScrap.js'
import { UseWarpDrive } from '../actions/useWarpDrive.js'
import { UseDimensionalRift } from '../actions/useDimensionalRift.js'
import { UseConscription } from '../actions/useConscription.js'
import { UseFactoryOverride } from '../actions/useFactoryOverride.js'
import { UseColonyShip } from '../actions/useColonyShip.js'

export const EarendelApiActions = {
    [ActionType.DrawPieces]: DrawPieces,
    [ActionType.UseLogisticsUpgrade]: UseLogisticsUpgrade,
    [ActionType.UseUpdatedLogistics]: UseUpdatedLogistics,
    [ActionType.UseTacticalFeint]: UseTacticalFeint,
    [ActionType.UseTradeRouteWormhole]: UseTradeRouteWormhole,
    [ActionType.UseImmediateDownload]: UseImmediateDownload,
    [ActionType.AttackSpread]: AttackSpread,
    [ActionType.DiscardPiece]: DiscardPiece,
    [ActionType.PlaceTile]: PlaceTile,
    [ActionType.MovePiece]: MovePiece,
    [ActionType.AttackPiece]: AttackPiece,
    [ActionType.ChooseTechnology]: ChooseTechnology,
    [ActionType.ChoosePlanet]: ChoosePlanet,
    [ActionType.PlacePiece]: PlacePiece,
    [ActionType.Pass]: Pass,
    [ActionType.EndTurn]: EndTurn,
    [ActionType.Terraform]: Terraform,
    [ActionType.ChooseEventOrder]: ChooseEventOrder,
    [ActionType.EventPick]: EventPick,
    [ActionType.SeedNebula]: SeedNebula,
    [ActionType.FoundPlanet]: FoundPlanet,
    [ActionType.StowShip]: StowShip,
    [ActionType.UseTacticalShift]: UseTacticalShift,
    [ActionType.UseBeyondTheFrontier]: UseBeyondTheFrontier,
    [ActionType.UseSpoofedOrders]: UseSpoofedOrders,
    [ActionType.UseAsteroidField]: UseAsteroidField,
    [ActionType.UseSecurityBreach]: UseSecurityBreach,
    [ActionType.PlayScrap]: PlayScrap,
    [ActionType.UseWarpDrive]: UseWarpDrive,
    [ActionType.UseDimensionalRift]: UseDimensionalRift,
    [ActionType.UseConscription]: UseConscription,
    [ActionType.UseFactoryOverride]: UseFactoryOverride,
    [ActionType.UseColonyShip]: UseColonyShip
}
