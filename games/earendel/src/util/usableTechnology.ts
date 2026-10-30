import { ActionType } from '../definition/actions.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { canUseCooldownEffect } from './cooldowns.js'
import { downloadAnchorsFor, downloadTargetsFrom } from './download.js'
import { feintableShips, wakeableFighters } from './legality.js'
import { wormholableShips } from './wormhole.js'

export type TechnologyUseAction =
    | ActionType.UseUpdatedLogistics
    | ActionType.UseTacticalFeint
    | ActionType.UseTradeRouteWormhole
    | ActionType.UseImmediateDownload

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

    return usable
}
