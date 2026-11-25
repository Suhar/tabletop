import { assertExists, type MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { PayRevenue } from '../actions/payRevenue.js'
import type { HydratedConduitGameState } from '../model/gameState.js'

export function startTurn(state: HydratedConduitGameState, playerId: string) {
    state.turnManager.startTurn(playerId, state.actionCount)
    state.activePlayerIds = [playerId]
}

export function endTurn(state: HydratedConduitGameState) {
    state.turnManager.endTurn(state.actionCount)
}

// Tiles resolve left to right: an offer while cubes remain on the track, then a placement by the
// buyer, or by the Start Player when no one bought it. Revenue follows the last tile.
export function nextResolutionState(
    context: MachineContext<HydratedConduitGameState>
): MachineState {
    const state = context.gameState
    if (state.currentOffer()) {
        return MachineState.Offering
    }
    if (state.pendingPlacement()) {
        return MachineState.Placing
    }
    return startRevenue(context)
}

// Revenue waits while owners choose among equally good routes that would pay tolls to different
// players.
export function startRevenue(context: MachineContext<HydratedConduitGameState>): MachineState {
    const state = context.gameState
    const choices = state.findRouteChoices()
    if (choices.length > 0) {
        state.routeChoices = choices
        return MachineState.ChoosingRoutes
    }
    context.addSystemAction(PayRevenue)
    return MachineState.PayingRevenue
}

export function offeredPlayerId(state: HydratedConduitGameState): string {
    const offer = state.currentOffer()
    assertExists(offer, 'A tile is on offer')
    return offer.playerId
}

export function placingPlayerId(state: HydratedConduitGameState): string {
    const placement = state.pendingPlacement()
    assertExists(placement, 'A tile is waiting to be placed')
    return placement.playerId
}
