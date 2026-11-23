import type { AxialCoordinates } from '@tabletop/common'
import type { HydratedEarendelGameState } from './../model/gameState.js'
import { getHex } from '../model/board.js'
import { PieceType } from '../model/pieces.js'
import { attackableTargets } from './attack.js'
import { chainsCompletedBy, planetPairKey } from './chains.js'
import { refreshPlanetControl } from './control.js'
import { probeDestinations } from './exploration.js'
import { stationComplexSummary, stationGroupPoints } from './stations.js'
import type { StationComplexSummary } from '../model/stationComplex.js'
import { terraformablePlanets } from './terraform.js'
import type { CompletedChain } from './chains.js'

// The ship must already stand at coords: it is read off the board, not passed in.
export type Arrival = {
    stationPoints: number
    // Set when a station scored: what its complex held.
    complex?: StationComplexSummary
    // Carries pairKey, which the caller strips before recording in metadata.
    chains: CompletedChain[]
    probeDestinations: AxialCoordinates[]
}

export function resolveArrival(
    state: HydratedEarendelGameState,
    playerId: string,
    coords: AxialCoordinates
): Arrival {
    const playerState = state.getPlayerState(playerId)
    const piece = getHex(state.board, coords)?.piece
    if (!piece) {
        throw Error('resolveArrival called for a hex with no ship on it')
    }

    // An opening station scores nothing on arrival (rules.md, Setup); it still counts toward
    // control and is a station for every placement that follows.
    const scores = piece.type === PieceType.Station && !piece.founding
    const stationPoints = scores ? stationGroupPoints(state.board, playerId, coords) : 0
    playerState.score += stationPoints
    const complex = scores ? stationComplexSummary(state.board, playerId, coords) : undefined

    const joined = state.tradeRoutes.map((route) => planetPairKey(...route.planets))
    const chains = piece.founding ? [] : chainsCompletedBy(state.board, playerId, coords, joined)
    for (const chain of chains) {
        playerState.score += chain.points
        state.tradeRoutes.push({ planets: chain.planets, playerId })
    }

    const targets = attackableTargets(state.board, coords, playerId)
    if (targets.length > 0) {
        state.pendingAttack = { playerId, fighterCoords: coords, targets }
    }

    const destinations = probeDestinations(state, coords, piece)
    if (destinations.length > 0) {
        state.pendingExploration = {
            playerId,
            probeCoords: coords,
            candidatePlanets: destinations
        }
    }

    const terraformable = terraformablePlanets(state.board, coords)
    if (terraformable.length > 0) {
        state.pendingTerraform = { playerId, terraformerCoords: coords, planets: terraformable }
    }

    refreshPlanetControl(state)

    return {
        stationPoints,
        ...(complex ? { complex } : {}),
        chains,
        probeDestinations: destinations
    }
}
