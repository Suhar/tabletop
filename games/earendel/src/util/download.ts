import type { AxialCoordinates } from '@tabletop/common'
import { getHex, HexKind, planetCoordinates } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { TechnologyEffectKind } from '../model/technology.js'
import { planetsInSightOf } from './lineOfSight.js'

// Which planet is holding this player's Immediate Download, and so where the line of sight is
// measured from.
//
// The anchor has to be looked up on the board rather than remembered, because a stored effect is
// recorded on the player as a bare kind - there is nowhere in playerState to keep "and it came
// from that planet". Which is fine: a technology's card never leaves the planet it was housed on,
// so the board is a stable record of where each of a player's technologies lives.
//
// Returns every anchor, not one, because nothing stops two planets holding a Download and one
// player gaining both. Each is spent from its own planet, and they see different things.
export function downloadAnchorsFor(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    const held = new Set(state.getPlayerState(playerId).technologies)

    return planetCoordinates(state.board).filter((coords) => {
        const hex = getHex(state.board, coords)
        return (
            hex?.technology !== undefined &&
            held.has(hex.technology.id) &&
            hex.technology.effect?.kind === TechnologyEffectKind.ImmediateDownload
        )
    })
}

// The planets a Download sitting on this one could take a technology from: in clear line of
// sight, explored, holding a technology, and holding one this player doesn't already have.
//
// Explored is not a separate rule so much as a consequence - an unexplored planet holds no
// technology yet - but it is checked by name because the wording says "explored planet", and a
// reader should be able to find that in the code.
export function downloadTargetsFrom(
    state: HydratedEarendelGameState,
    playerId: string,
    anchor: AxialCoordinates
): AxialCoordinates[] {
    const held = new Set(state.getPlayerState(playerId).technologies)

    return planetsInSightOf(state.board, anchor).filter((coords) => {
        const hex = getHex(state.board, coords)
        if (hex?.kind !== HexKind.Planet) return false
        if (!hex.explored || !hex.technology) return false
        // Already theirs: there is nothing to download, and spending a one-shot power on it
        // would be a trap rather than a choice.
        return !held.has(hex.technology.id)
    })
}
