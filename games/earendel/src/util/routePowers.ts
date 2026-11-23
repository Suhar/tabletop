import { getHex, hasRoutePower, planetCoordinates } from '../model/board.js'
import type { Piece } from '../model/pieces.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { PLANET_COLORS, PlanetColor } from '../model/planetColor.js'
import { controllerOf } from './control.js'

// Planets of one color that give its power without a route (rules.md, What control is for).
export function colorSetSize(playerCount: number): number {
    return playerCount === 2 ? 2 : 3
}

export function controlledColorCounts(
    state: HydratedEarendelGameState,
    playerId: string
): Map<PlanetColor, number> {
    const counts = new Map<PlanetColor, number>()
    for (const coords of planetCoordinates(state.board)) {
        const hex = getHex(state.board, coords)
        if (hex?.color === undefined) continue
        if (controllerOf(state, coords) !== playerId) continue
        counts.set(hex.color, (counts.get(hex.color) ?? 0) + 1)
    }
    return counts
}

export function controlsEveryColor(state: HydratedEarendelGameState, playerId: string): boolean {
    return controlledColorCounts(state, playerId).size === PLANET_COLORS.length
}

// A color's power is held through a standing route of that color, or through control of enough
// planets of it.
export function routePowersFor(state: HydratedEarendelGameState, playerId: string): PlanetColor[] {
    const controlled = controlledColorCounts(state, playerId)
    const needed = colorSetSize(state.players.length)
    return PLANET_COLORS.filter(
        (color) =>
            state.tradeRoutes.some(
                (route) => route.playerId === playerId && route.color === color
            ) || (controlled.get(color) ?? 0) >= needed
    )
}

export const FIVE_COLOR_POINTS = 2

// Bounty, the violet power: 1 point for each enemy piece the player's fighters or torpedoes
// destroy. Judged before the board is settled, so a power lost by the shot still pays for it.
export function payBounty(
    state: HydratedEarendelGameState,
    playerId: string,
    destroyed: Piece[]
): number {
    if (!hasRoutePower(state.board, playerId, PlanetColor.Violet)) return 0
    const points = destroyed.filter((piece) => piece.playerId !== playerId).length
    state.getPlayerState(playerId).score += points
    return points
}
