import { ActionType } from '../definition/actions.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { canUseCooldownEffect } from './cooldowns.js'
import { downloadAnchorsFor, downloadTargetsFrom } from './download.js'
import { feintableShips, wakeableFighters } from './legality.js'
import { wormholableShips } from './wormhole.js'
import { legalMovesFor, legalRiftsFor, legalWarpsFor } from './movement.js'
import { spoofablePieces } from './spoofing.js'
import { canGrowBoard } from '../actions/useBeyondTheFrontier.js'
import { canConscript } from '../actions/useConscription.js'
import { canOverrideFactory } from '../actions/useFactoryOverride.js'
import { settleablePlanets } from '../actions/useColonyShip.js'

export type TechnologyUseAction =
    | ActionType.UseUpdatedLogistics
    | ActionType.UseTacticalFeint
    | ActionType.UseTradeRouteWormhole
    | ActionType.UseImmediateDownload
    | ActionType.UseTacticalShift
    | ActionType.UseWarpDrive
    | ActionType.UseConscription
    | ActionType.UseFactoryOverride
    | ActionType.UseColonyShip
    | ActionType.UseDimensionalRift
    | ActionType.UseBeyondTheFrontier
    | ActionType.UseSpoofedOrders
    | ActionType.UseAsteroidField
    | ActionType.UseSecurityBreach

// The technologies a player could use right now and that have something to act on: what keeps
// their turn open once their ships are placed.
export function usableTechnologies(
    state: HydratedEarendelGameState,
    playerId: string
): TechnologyUseAction[] {
    if (state.pendingAttack || state.pendingExploration) return []
    if (state.pendingTechnology || state.pendingTile) return []

    const playerState = state.getPlayerState(playerId)
    const usable: TechnologyUseAction[] = []

    if (
        canUseCooldownEffect(state, playerId, TechnologyEffectKind.UpdatedLogistics) &&
        wakeableFighters(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseUpdatedLogistics)
    }
    if (
        canUseCooldownEffect(state, playerId, TechnologyEffectKind.TacticalFeint) &&
        feintableShips(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseTacticalFeint)
    }
    if (
        canUseCooldownEffect(state, playerId, TechnologyEffectKind.TradeRouteWormhole) &&
        wormholableShips(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseTradeRouteWormhole)
    }
    if (
        playerState.hasStoredEffect(TechnologyEffectKind.ImmediateDownload) &&
        downloadAnchorsFor(state, playerId).some(
            (anchor) => downloadTargetsFrom(state, playerId, anchor).length > 0
        )
    ) {
        usable.push(ActionType.UseImmediateDownload)
    }

    if (
        playerState.hasStoredEffect(TechnologyEffectKind.MoveFriendlyPiece) &&
        legalMovesFor(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseTacticalShift)
    }
    if (
        playerState.hasStoredEffect(TechnologyEffectKind.WarpDrive) &&
        legalWarpsFor(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseWarpDrive)
    }
    if (canConscript(state, playerId)) usable.push(ActionType.UseConscription)
    if (canOverrideFactory(state, playerId)) usable.push(ActionType.UseFactoryOverride)
    if (
        playerState.hasStoredEffect(TechnologyEffectKind.ColonyShip) &&
        settleablePlanets(state, playerId).length > 0
    ) {
        usable.push(ActionType.UseColonyShip)
    }
    if (
        playerState.hasStoredEffect(TechnologyEffectKind.DimensionalRift) &&
        legalRiftsFor(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseDimensionalRift)
    }
    if (playerState.hasStoredEffect(TechnologyEffectKind.GrowBoard) && canGrowBoard(state)) {
        usable.push(ActionType.UseBeyondTheFrontier)
    }

    if (
        playerState.hasStoredEffect(TechnologyEffectKind.SpoofedOrders) &&
        spoofablePieces(state.board, playerId).length > 0
    ) {
        usable.push(ActionType.UseSpoofedOrders)
    }
    if (playerState.hasStoredEffect(TechnologyEffectKind.AsteroidField)) {
        usable.push(ActionType.UseAsteroidField)
    }
    if (playerState.hasStoredEffect(TechnologyEffectKind.SecurityBreach)) {
        usable.push(ActionType.UseSecurityBreach)
    }

    return usable
}
