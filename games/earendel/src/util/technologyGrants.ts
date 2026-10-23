import type { AxialCoordinates } from '@tabletop/common'
import {
    dominantPlayerId,
    type EarendelBoard,
    getHex,
    HexKind,
    neighborsOf,
    planetCoordinates
} from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import {
    cooldownEffectOf,
    grantedPieceOf,
    hasImmediateEffect,
    storedEffectOf,
    type TechnologyCard,
    TechnologyEffectKind
} from '../model/technology.js'
import type { PendingTechnology } from '../model/exploration.js'
import { probeLeaderOf } from './probes.js'
import { type Piece, PieceType } from '../model/pieces.js'

// Settles this player's probe claims at the start of their turn: every claim whose planet their
// probes still lead on - strictly the most probe influence - becomes theirs, and every other claim
// lapses. Either way the claims are spent, since each was only ever good for this one turn.
//
// This is the whole of how a technology changes hands. Holding a planet with stations and fighters
// scores it but does not win what it holds; surveying it with probes and keeping the lead for a
// round does. A rival who outweighs your probes in between doesn't take the technology - they only
// stop you getting it, unless they survey the planet and stake a claim of their own.
export function probeTechnologiesFor(
    state: HydratedEarendelGameState,
    playerId: string
): { gained: TechnologyCard[]; lapsed: TechnologyCard[] } {
    const held = state.getPlayerState(playerId).technologies
    const gained: TechnologyCard[] = []
    const lapsed: TechnologyCard[] = []

    for (const claim of state.probeClaims) {
        if (claim.playerId !== playerId) continue
        const card = getHex(state.board, claim.coords)?.technology
        if (!card || card.id !== claim.technologyId) continue
        if (held.includes(card.id) || gained.some((other) => other.id === card.id)) continue

        if (probeLeaderOf(state.board, claim.coords) === playerId) {
            gained.push(card)
        } else {
            lapsed.push(card)
        }
    }

    return { gained, lapsed }
}

// Hands one technology to one player: the id for the ledger, and anything the card stores for
// them to spend later. The single place a technology changes hands, so the explorer and a
// later conqueror cannot drift apart.
export function grantTechnology(
    state: HydratedEarendelGameState,
    playerId: string,
    card: TechnologyCard
) {
    const playerState = state.getPlayerState(playerId)
    playerState.technologies.push(card.id)

    const stored = storedEffectOf(card)
    if (stored) playerState.storedEffects.push(stored)

    const repeatable = cooldownEffectOf(card)
    if (repeatable && !playerState.cooldownEffects.includes(repeatable)) {
        playerState.cooldownEffects.push(repeatable)
    }

    const granted = grantedPieceOf(card)
    if (granted) {
        const piece = grantedPiece(granted, playerId, card.id)
        if (piece) playerState.specialPieces.push(piece)
    }
}

// The piece a granting technology hands over. Named from the card as well as the player, so the
// same planet cannot hand the same player two of them.
function grantedPiece(
    kind: TechnologyEffectKind,
    playerId: string,
    technologyId: string
): Piece | undefined {
    if (kind === TechnologyEffectKind.StationUpgrade) {
        return {
            id: `${playerId}-hub-${technologyId}`,
            playerId,
            type: PieceType.Station,
            hub: true
        }
    }
    return undefined
}

// Settles this player's probe claims, hands over every technology they kept, and lines up any
// that act at once. Called at the top of a turn, which is the only moment a technology ever
// changes hands.
//
// Returns the cards gained and lapsed so the action that triggered it can report them: nobody was
// looking at the board when either was decided - each is the outcome of a round of other turns.
export function claimProbeTechnologies(
    state: HydratedEarendelGameState,
    playerId: string
): { gained: TechnologyCard[]; lapsed: TechnologyCard[] } {
    const { gained, lapsed } = probeTechnologiesFor(state, playerId)
    state.probeClaims = state.probeClaims.filter((claim) => claim.playerId !== playerId)

    const effects: PendingTechnology[] = []

    for (const card of gained) {
        grantTechnology(state, playerId, card)

        // GrowBoard is handled apart from the others because it needs a tile drawn for it, and
        // the supply can be empty - in which case the technology simply comes to nothing.
        if (hasImmediateEffect(card)) {
            effects.push({ playerId, technologyId: card.id, kind: card.effect!.kind })
        }
    }

    // The first effect goes into the slot the resolving states already watch; the rest wait.
    const [first, ...rest] = effects
    state.queuedTechnologyEffects = rest
    if (first) activateTechnologyEffect(state, first)

    return { gained, lapsed }
}

// Puts one owed effect into the slot its resolving state watches. GrowBoard wants a tile in
// hand; everything else waits on pendingTechnology.
export function activateTechnologyEffect(
    state: HydratedEarendelGameState,
    effect: PendingTechnology
) {
    if (effect.kind === TechnologyEffectKind.GrowBoard) {
        const tile = state.tileSupply.shift()
        if (tile) state.pendingTile = { playerId: effect.playerId, tile }
        return
    }
    state.pendingTechnology = effect
}

// Pulls the next owed effect into play, if any. Returns whether one was activated, so the
// caller can decide between carrying on with the turn and resolving another effect.
export function activateNextTechnologyEffect(state: HydratedEarendelGameState): boolean {
    const [next, ...rest] = state.queuedTechnologyEffects
    if (!next) return false

    state.queuedTechnologyEffects = rest
    activateTechnologyEffect(state, next)

    // An empty tile supply leaves GrowBoard with nothing to do, so it isn't really pending -
    // skip straight past it rather than stalling the turn on an effect that cannot happen.
    if (!state.pendingTile && !state.pendingTechnology) {
        return activateNextTechnologyEffect(state)
    }
    return true
}
