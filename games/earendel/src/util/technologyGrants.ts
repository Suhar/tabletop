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
import { type Piece, PieceType } from '../model/pieces.js'

// Every explored planet this player holds outright and whose technology they don't yet have -
// the technologies that are ripe for them RIGHT NOW.
//
// This is the whole of the timing rule. A technology is never handed over at the moment control
// changes; it is handed over at the start of a turn, to whoever is holding the planet outright
// when that turn begins. So exploring a planet no longer wins its technology - it decides what
// the planet holds and starts a wait. Hold the planet until your next turn and it is yours; let
// someone break your hold and they are the one waiting, from their next turn.
//
// Nothing needs to be remembered between turns for this. There is no timer in state, because
// control is only ever asked about at one instant - the beginning of a turn - and a player who
// loses and retakes a planet in between arrives at that instant holding it, which is all the
// rule asks. (An earlier draft tracked a per-planet claim so that a broken hold voided the
// wait; settled the other way, and this is much the simpler half of that bargain.)
//
// Read over the whole board rather than around one hex, because it is no longer answering
// "what did that move just win?" but "what has this player held long enough to keep?".
export function technologiesRipeFor(
    board: EarendelBoard,
    playerId: string,
    alreadyHeld: string[]
): TechnologyCard[] {
    const ripe: TechnologyCard[] = []

    for (const coords of planetCoordinates(board)) {
        const hex = getHex(board, coords)
        if (!hex?.technology) continue
        if (alreadyHeld.includes(hex.technology.id)) continue
        if (ripe.some((card) => card.id === hex.technology!.id)) continue
        if (dominantPlayerId(board, coords) !== playerId) continue

        ripe.push(hex.technology)
    }

    return ripe
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

// Hands this player every technology ripe for them, and lines up any that act at once.
// Called at the top of a turn, which is the only moment a technology ever changes hands.
//
// Returns the ids gained so the action that triggered it can report them: a technology
// arriving is worth announcing, and unlike the old model nobody was looking at the board when
// it happened - it is the consequence of a hold that survived a full round.
export function claimRipeTechnologies(
    state: HydratedEarendelGameState,
    playerId: string
): string[] {
    const playerState = state.getPlayerState(playerId)
    const ripe = technologiesRipeFor(state.board, playerId, playerState.technologies)
    if (ripe.length === 0) return []

    const effects: PendingTechnology[] = []

    for (const card of ripe) {
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

    return ripe.map((card) => card.id)
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
