import type { AxialCoordinates } from '@tabletop/common'
import type { HydratedEarendelGameState } from './../model/gameState.js'
import { getHex } from '../model/board.js'
import { PieceLevel, PieceType } from '../model/pieces.js'
import { attackableTargets } from './attack.js'
import { chainsCompletedBy } from './chains.js'
import { refreshPlanetControl } from './control.js'
import { explorablePlanets } from './exploration.js'
import { stationGroupPoints } from './stations.js'
import type { CompletedChain } from './chains.js'

// Everything a ship arriving on a hex sets off, in one place.
//
// This was the back half of PlacePiece, and it stayed there while a placement was the only way
// a ship could arrive. Tactical Feint breaks that: it swaps a ship into an enemy's hex and then,
// by its own wording, treats it as if it had just been placed - which means all of this, not some
// of it. Two implementations of "just placed" would drift apart, and the one that drifted would
// be the rarely-taken path.
//
// The ship must already be ON the board at coords when this is called: what it does depends on
// its type and level, and reading those off the board rather than taking them as arguments means
// a caller cannot describe the arriving ship differently from the one that actually arrived.
export type Arrival = {
    stationPoints: number
    // Carries pairKey, which the caller strips before recording in metadata - history shows the
    // chain, the key is bookkeeping.
    chains: CompletedChain[]
    explorable: AxialCoordinates[]
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

    // A station pays for the company it keeps: one for itself, one for each station already in
    // the group it joins. Scored on every arrival, so a cluster built up one station at a time
    // pays 1, 2, 3, ...
    const stationPoints =
        piece.type === PieceType.Station
            ? stationGroupPoints(state.board, playerId, coords)
            : 0
    playerState.score += stationPoints

    // Joining two planets of one colour pays T(n) on the n ships between them. Scored here, on
    // the arrival that completes it, and never again for that pair.
    const chains = chainsCompletedBy(state.board, playerId, coords, state.scoredPlanetPairs)
    for (const chain of chains) {
        playerState.score += chain.points
        state.scoredPlanetPairs.push(chain.pairKey)
    }

    // Taking outright hold of an explored planet no longer hands its technology over on the
    // spot: it is claimed at the start of a turn by whoever is still holding the planet then
    // (see claimRipeTechnologies). So an arrival that seizes a planet wins nothing yet - it
    // starts a wait, and announces itself when the wait pays.

    // A fighter arrives shooting: it may destroy one adjacent piece weaker than itself.
    // Optional, and the target is the player's choice, so it parks a decision rather than
    // resolving here.
    const targets = attackableTargets(state.board, coords, playerId)
    if (targets.length > 0) {
        state.pendingAttack = { playerId, fighterCoords: coords, targets }
    }

    // A probe landing beside unexplored planets doesn't resolve anything here: which planet it
    // explores is the player's choice, and the reveal that follows consumes the technology deck.
    // Both belong in their own actions so each is separately undoable and the deck is only
    // touched once the target is settled.
    const explorable = explorablePlanets(state.board, coords, piece.type)
    if (explorable.length > 0) {
        state.pendingExploration = {
            playerId,
            probeCoords: coords,
            // A probe won from a technology may not carry a level of its own; the weaker level
            // is the safe reading.
            probeLevel: piece.level ?? PieceLevel.Two,
            candidatePlanets: explorable
        }
    }

    // Control is recomputed once the board is settled: a tie now leaves whoever held the planet
    // holding it, so this cannot be read off the board later.
    refreshPlanetControl(state)

    return { stationPoints, chains, explorable }
}
