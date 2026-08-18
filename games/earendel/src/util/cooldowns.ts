import { COOLDOWN_TURNS, TechnologyEffectKind } from '../model/technology.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'

// A cooldown is counted in the owner's OWN turns, not in rounds - so a power is idle for the same
// stretch of that player's game whatever the player count.
//
// turnCount is the number of turns they have finished, so it is the same number all through the
// turn they are taking. Using a power on a turn therefore stamps that turn's number, and the
// power returns on the third turn after it.
export function turnsSinceUse(
    state: HydratedEarendelGameState,
    playerId: string,
    kind: TechnologyEffectKind
): number | undefined {
    const usedAt = state.getPlayerState(playerId).cooldowns[kind]
    return usedAt === undefined ? undefined : state.turnManager.turnCount(playerId) - usedAt
}

// Whether this player can use the power right now: they have to hold it, and its timer has to
// have run out.
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

// How many more of this player's turns until the power is ready, or 0 if it is.
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
