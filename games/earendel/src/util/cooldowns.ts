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

// The countdown the player panel shows. It ticks as each of the owner's turns begins, so it stays
// full from the use until their next turn starts and empties on the turn the power is ready.
export function turnsUntilReady(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
): number {
    const since = turnsSinceUse(state, playerId, kind)
    if (since === undefined) return 0
    const begunSinceUse = state.activePlayerIds.includes(playerId) ? since : since - 1
    return Math.min(COOLDOWN_TURNS, Math.max(0, COOLDOWN_TURNS - begunSinceUse))
}

export function startCooldown(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
) {
    state.getPlayerState(playerId).cooldowns[kind] = state.turnManager.turnCount(playerId)
}
