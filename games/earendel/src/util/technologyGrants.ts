import { getHex } from '../model/board.js'
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
import { drawFrom } from './drawBags.js'
import { type Piece, PieceType } from '../model/pieces.js'

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

export function claimProbeTechnologies(
    state: HydratedEarendelGameState,
    playerId: string
): { gained: TechnologyCard[]; lapsed: TechnologyCard[] } {
    const { gained, lapsed } = probeTechnologiesFor(state, playerId)
    state.probeClaims = state.probeClaims.filter((claim) => claim.playerId !== playerId)

    const effects: PendingTechnology[] = []

    for (const card of gained) {
        grantTechnology(state, playerId, card)

        if (hasImmediateEffect(card)) {
            effects.push({ playerId, technologyId: card.id, kind: card.effect!.kind })
        }
    }

    const [first, ...rest] = effects
    state.queuedTechnologyEffects = rest
    if (first) activateTechnologyEffect(state, first)

    return { gained, lapsed }
}

export function activateTechnologyEffect(
    state: HydratedEarendelGameState,
    effect: PendingTechnology
) {
    if (effect.kind === TechnologyEffectKind.GrowBoard) {
        const tile = drawFrom(state.tileSupply)
        if (tile) state.pendingTile = { playerId: effect.playerId, tile }
        return
    }
    state.pendingTechnology = effect
}

export function activateNextTechnologyEffect(state: HydratedEarendelGameState): boolean {
    const [next, ...rest] = state.queuedTechnologyEffects
    if (!next) return false

    state.queuedTechnologyEffects = rest
    activateTechnologyEffect(state, next)

    if (!state.pendingTile && !state.pendingTechnology) {
        return activateNextTechnologyEffect(state)
    }
    return true
}
