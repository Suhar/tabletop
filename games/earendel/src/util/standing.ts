import type { HydratedEarendelGameState } from '../model/gameState.js'
import { refreshPlanetControl } from './control.js'
import { routePowersFor } from './routePowers.js'
import { settleTradeRoutes } from './tradeRoutes.js'

function refreshRoutePowers(state: HydratedEarendelGameState): boolean {
    const powers = Object.fromEntries(
        state.players
            .map((player) => [player.playerId, routePowersFor(state, player.playerId)] as const)
            .filter(([, colors]) => colors.length > 0)
    )
    const changed = JSON.stringify(powers) !== JSON.stringify(state.board.routePowers ?? {})
    state.board.routePowers = powers
    return changed
}

// Everything that follows from where the pieces now stand: who controls each planet, which trade
// routes hold, and the powers both give. A power can change control (Strongholds), and control
// can give a power, so it is settled until nothing moves.
export function refreshStanding(
    state: HydratedEarendelGameState,
    routes: { unpaid?: boolean } = {}
) {
    for (let pass = 0; pass < state.players.length + 2; pass++) {
        refreshPlanetControl(state)
        settleTradeRoutes(state, routes)
        if (!refreshRoutePowers(state)) return
    }
}
