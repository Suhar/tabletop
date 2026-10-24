import type { AxialCoordinates } from '@tabletop/common'
import type { HydratedEarendelGameState } from './../model/gameState.js'
import { getHex } from '../model/board.js'
import { PieceLevel, PieceType } from '../model/pieces.js'
import { attackableTargets } from './attack.js'
import { chainsCompletedBy, planetPairKey } from './chains.js'
import { refreshPlanetControl } from './control.js'
import { probeDestinations } from './exploration.js'
import { stationGroupPoints } from './stations.js'
import type { CompletedChain } from './chains.js'

// The ship must already stand at coords: it is read off the board, not passed in.
export type Arrival = {
    stationPoints: number
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

    const stationPoints =
        piece.type === PieceType.Station ? stationGroupPoints(state.board, playerId, coords) : 0
    playerState.score += stationPoints

    const joined = state.tradeRoutes.map((route) => planetPairKey(...route.planets))
    const chains = chainsCompletedBy(state.board, playerId, coords, joined)
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
            probeLevel: piece.level ?? PieceLevel.Two,
            candidatePlanets: destinations
        }
    }

    refreshPlanetControl(state)

    return { stationPoints, chains, probeDestinations: destinations }
}
