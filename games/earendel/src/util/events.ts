import { type AxialCoordinates, sameCoordinates } from '@tabletop/common'
import {
    getHex,
    hexKey,
    HexKind,
    isOpenHex,
    neighborsOf,
    planetCoordinates
} from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import type { PendingEvent } from '../model/event.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { SPECIAL_PIECE_TECHNOLOGIES, TechnologyEffectKind } from '../model/technology.js'
import { probeBlockedBy } from './lineOfSight.js'
import { grantedPieces, grantTechnology } from './technologyGrants.js'
import { refreshStanding } from './standing.js'
import { salvageDestroyed } from './elevated.js'
import { interdictedFor } from './specials.js'

// One player's pick in an elevated event; which fields apply depends on the event.
export type EventChoice = {
    coords?: AxialCoordinates
    from?: AxialCoordinates
    to?: AxialCoordinates
    technologyId?: string
    // Shipyard World: the technology whose unit is taken.
    piece?: TechnologyEffectKind
}

export type EventOutcome = {
    destroyed?: Piece
    salvaged?: { piece: Piece; playerId: string }[]
    moved?: Piece
    technologyId?: string
    planet?: AxialCoordinates
    piece?: TechnologyEffectKind
}

// Orbital Targeting: any enemy probe or fighter, wherever it stands.
export function bombardmentTargets(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    return Object.values(state.board.hexes)
        .filter(
            (hex) =>
                hex.piece &&
                hex.piece.playerId !== playerId &&
                (hex.piece.type === PieceType.Probe || hex.piece.type === PieceType.Fighter)
        )
        .map((hex) => hex.coords)
}

// Wormhole Storm: any piece of the player's own.
export function stormOrigins(
    state: HydratedEarendelGameState,
    playerId: string
): AxialCoordinates[] {
    return Object.values(state.board.hexes)
        .filter((hex) => hex.piece?.playerId === playerId)
        .map((hex) => hex.coords)
}

// Wormhole Storm: any empty open hex beside a planet, barring hexes closed to the probe.
export function stormDestinations(
    state: HydratedEarendelGameState,
    from: AxialCoordinates
): AxialCoordinates[] {
    const piece = getHex(state.board, from)?.piece
    if (!piece) return []
    const besidePlanets = new Set<number>()
    for (const planet of planetCoordinates(state.board)) {
        for (const neighbor of neighborsOf(planet)) besidePlanets.add(hexKey(neighbor))
    }
    return Object.values(state.board.hexes)
        .filter(
            (hex) =>
                hex.kind === HexKind.Open &&
                isOpenHex(state.board, hex.coords) &&
                besidePlanets.has(hexKey(hex.coords)) &&
                !interdictedFor(state.board, hex.coords, piece.playerId) &&
                (piece.type !== PieceType.Probe ||
                    probeBlockedBy(state.board, hex.coords, piece.playerId) === undefined)
        )
        .map((hex) => hex.coords)
}

// Salvage Rights: any discarded technology the player does not hold, each card once.
export function salvageChoices(state: HydratedEarendelGameState, playerId: string): string[] {
    const held = state.getPlayerState(playerId).technologies
    return [...new Set(state.technologyDiscard)].filter((id) => !held.includes(id))
}

// Signal Intercept: any explored planet holding a technology the player lacks, not yet intercepted.
export function interceptTargets(
    state: HydratedEarendelGameState,
    pending: PendingEvent,
    playerId: string
): AxialCoordinates[] {
    const held = state.getPlayerState(playerId).technologies
    const intercepted = pending.intercepted ?? []
    return Object.values(state.board.hexes)
        .filter(
            (hex) =>
                hex.kind === HexKind.Planet &&
                hex.technologyId !== undefined &&
                !held.includes(hex.technologyId) &&
                !intercepted.some((taken) => sameCoordinates(taken, hex.coords))
        )
        .map((hex) => hex.coords)
}

// Shipyard World: whatever units the stock still holds.
export function shipyardChoices(pending: PendingEvent): TechnologyEffectKind[] {
    const stock = pending.stock ?? {}
    return SPECIAL_PIECE_TECHNOLOGIES.filter((kind) => (stock[kind] ?? 0) > 0)
}

export function hasEventPick(
    state: HydratedEarendelGameState,
    pending: PendingEvent,
    playerId: string
): boolean {
    switch (pending.kind) {
        case TechnologyEffectKind.OrbitalBombardment:
            return bombardmentTargets(state, playerId).length > 0
        case TechnologyEffectKind.WormholeStorm:
            return stormOrigins(state, playerId).some(
                (from) => stormDestinations(state, from).length > 0
            )
        case TechnologyEffectKind.SalvageRights:
            return salvageChoices(state, playerId).length > 0
        case TechnologyEffectKind.SignalIntercept:
            return interceptTargets(state, pending, playerId).length > 0
        case TechnologyEffectKind.ShipyardWorld:
            return shipyardChoices(pending).length > 0
        default:
            return false
    }
}

export function invalidEventChoiceReason(
    state: HydratedEarendelGameState,
    pending: PendingEvent,
    playerId: string,
    choice: EventChoice
): string | undefined {
    const among = (candidates: AxialCoordinates[], coords: AxialCoordinates | undefined) =>
        coords !== undefined && candidates.some((candidate) => sameCoordinates(candidate, coords))

    switch (pending.kind) {
        case TechnologyEffectKind.OrbitalBombardment:
            if (!among(bombardmentTargets(state, playerId), choice.coords)) {
                return 'The bombardment takes an enemy probe or fighter.'
            }
            return undefined
        case TechnologyEffectKind.WormholeStorm:
            if (!among(stormOrigins(state, playerId), choice.from)) {
                return 'The storm moves one of your own pieces.'
            }
            if (!choice.from || !among(stormDestinations(state, choice.from), choice.to)) {
                return 'The storm sets a piece down on an empty hex beside a planet.'
            }
            return undefined
        case TechnologyEffectKind.SalvageRights:
            if (
                !choice.technologyId ||
                !salvageChoices(state, playerId).includes(choice.technologyId)
            ) {
                return 'Salvage takes a discarded technology you do not already hold.'
            }
            return undefined
        case TechnologyEffectKind.SignalIntercept:
            if (!among(interceptTargets(state, pending, playerId), choice.coords)) {
                return 'An intercept takes an explored planet not yet intercepted, holding a technology you lack.'
            }
            return undefined
        case TechnologyEffectKind.ShipyardWorld:
            if (!choice.piece || !shipyardChoices(pending).includes(choice.piece)) {
                return 'The shipyard has none of those left.'
            }
            return undefined
        default:
            return 'That event has no picks.'
    }
}

export function applyEventChoice(
    state: HydratedEarendelGameState,
    pending: PendingEvent,
    playerId: string,
    choice: EventChoice
): EventOutcome {
    switch (pending.kind) {
        case TechnologyEffectKind.OrbitalBombardment: {
            const hex = state.board.hexes[hexKey(choice.coords!)]
            const destroyed = hex.piece!
            hex.piece = undefined
            const salvaged = salvageDestroyed(
                state,
                [{ piece: destroyed, at: choice.coords! }],
                playerId
            )
            refreshStanding(state)
            return { destroyed, ...(salvaged.length > 0 ? { salvaged } : {}) }
        }
        case TechnologyEffectKind.WormholeStorm: {
            const origin = state.board.hexes[hexKey(choice.from!)]
            const moved = origin.piece!
            origin.piece = undefined
            delete moved.surveying
            state.board.hexes[hexKey(choice.to!)].piece = moved
            refreshStanding(state)
            return { moved }
        }
        case TechnologyEffectKind.SalvageRights: {
            const technologyId = choice.technologyId!
            const index = state.technologyDiscard.indexOf(technologyId)
            state.technologyDiscard.splice(index, 1)
            gain(state, playerId, technologyId)
            return { technologyId }
        }
        case TechnologyEffectKind.SignalIntercept: {
            const planet = choice.coords!
            const technologyId = getHex(state.board, planet)!.technologyId!
            pending.intercepted = [...(pending.intercepted ?? []), planet]
            gain(state, playerId, technologyId)
            return { technologyId, planet }
        }
        case TechnologyEffectKind.ShipyardWorld: {
            // The unit comes as its technology would grant it (a gate pair for Gate Network).
            const kind = choice.piece!
            pending.stock = { ...pending.stock, [kind]: (pending.stock?.[kind] ?? 1) - 1 }
            state
                .getPlayerState(playerId)
                .specialPieces.push(
                    ...grantedPieces(kind, playerId, `shipyard-${state.actionCount}`)
                )
            return { piece: kind }
        }
        default:
            throw Error(`${pending.kind} is not an elevated event`)
    }
}

function gain(state: HydratedEarendelGameState, playerId: string, technologyId: string) {
    grantTechnology(state, playerId, technologyId)
}
