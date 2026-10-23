import { COOLDOWN_TURNS, TechnologyEffectKind } from '../model/technology.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'

// Counted in the owner's own turns. turnCount is turns finished, so it holds steady through
// the turn being taken.
export function turnsSinceUse(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
): number | undefined {
    const usedAt = state.getPlayerState(playerId).cooldowns[kind]
    return usedAt === undefined ? undefined : state.turnManager.turnCount(playerId) - usedAt
}

export function canUseCooldownEffect(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
): boolean {
    if (!state.getPlayerState(playerId).hasCooldownEffect(kind)) return false

    const since = turnsSinceUse(state, playerId, kind)
    if (since === undefined) return true

    return since >= COOLDOWN_TURNS
}

export function turnsUntilReady(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
): number {
    const since = turnsSinceUse(state, playerId, kind)
    if (since === undefined) return 0
    return Math.max(0, COOLDOWN_TURNS - since)
}

export function startCooldown(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
) {
    state.getPlayerState(playerId).cooldowns[kind] = state.turnManager.turnCount(playerId)
}
