import type { AxialCoordinates, Prng } from '@tabletop/common'
import { getHex, hexKey } from '../model/board.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import type { OrbitedProbe } from '../model/exploration.js'
import { type Piece, PieceType } from '../model/pieces.js'
import { PLANET_COLORS } from '../model/planetColor.js'
import {
    ELEVATED_PAIRS,
    siblingEventOf,
    SPECIAL_PIECE_TECHNOLOGIES,
    TechnologyEffectKind,
    TechnologyTiming,
    timingOf
} from '../model/technology.js'
import { elevatedCardId, technologyCard } from '../model/technologyCards.js'
import { type EarendelGameConfig, ElevatedChoice, elevatedChoiceFor } from '../definition/config.js'
import { refreshPlanetControl } from './control.js'
import { returnToBag } from '../model/bags.js'
import { salvageClaimant } from './specials.js'

// One of each color's pair, as the game options say or as the setup draw decides.
export function selectElevatedCards(
    config: EarendelGameConfig,
    prng: Prng
): Record<string, string> {
    const chosen: Record<string, string> = {}
    for (const color of PLANET_COLORS) {
        const pair = ELEVATED_PAIRS[color]
        let choice = elevatedChoiceFor(config, color)
        if (choice === ElevatedChoice.Random) {
            choice = prng.random() < 0.5 ? ElevatedChoice.Event : ElevatedChoice.Rule
        }
        if (choice === ElevatedChoice.None) continue
        chosen[color] = elevatedCardId(choice === ElevatedChoice.Event ? pair.event : pair.rule)
    }
    return chosen
}

export function isElevatedCardId(technologyId: string): boolean {
    const timing = timingOf(technologyCard(technologyId))
    return timing === TechnologyTiming.Event || timing === TechnologyTiming.Rule
}

// Surveying an elevated planet spends it for everyone and starts its event (rules.md, Elevated
// technologies): every player counts as holding the card, the surveying probe and a marker for
// every other player go into orbit, and the picks begin, the discoverer first.
export function fireElevatedCard(
    state: HydratedEarendelGameState,
    discovererId: string,
    planet: AxialCoordinates,
    probeCoords: AxialCoordinates,
    technologyId: string
): { orbited: OrbitedProbe[]; event: TechnologyEffectKind; everyone: boolean } {
    const card = technologyCard(technologyId)
    const planetHex = state.board.hexes[hexKey(planet)]
    planetHex.technologyId = technologyId

    for (const player of state.players) {
        if (!player.technologies.includes(technologyId)) player.technologies.push(technologyId)
    }

    const orbited: OrbitedProbe[] = []
    const probeHex = getHex(state.board, probeCoords)
    const probe = probeHex?.piece
    if (probeHex && probe?.type === PieceType.Probe) {
        probeHex.piece = undefined
        planetHex.orbiters = [...(planetHex.orbiters ?? []), probe]
        orbited.push({ probe, from: probeCoords, planet })
    }
    for (const player of state.players) {
        if (player.playerId === discovererId) continue
        const marker: Piece = {
            id: `orbit-${technologyId}-${player.playerId}`,
            playerId: player.playerId,
            type: PieceType.Probe
        }
        planetHex.orbiters = [...(planetHex.orbiters ?? []), marker]
    }
    refreshPlanetControl(state)

    const everyone = timingOf(card) === TechnologyTiming.Event
    const event = everyone ? card.effect : siblingEventOf(card.effect)
    if (!event) throw Error(`${card.effect} is not an elevated card`)

    const others = state.players
        .map((player) => player.playerId)
        .filter((playerId) => playerId !== discovererId)
    const order = everyone
        ? others.length <= 1
            ? [discovererId, ...others]
            : undefined
        : [discovererId]

    // Shipyard World's stock: one of each unit in play.
    const unitsInPlay = state.pieceTechnologies
        ? Object.values(state.pieceTechnologies)
        : SPECIAL_PIECE_TECHNOLOGIES
    state.pendingEvent = {
        kind: event,
        discovererId,
        planet,
        ...(order ? { order } : {}),
        ...(event === TechnologyEffectKind.SignalIntercept ? { intercepted: [] } : {}),
        ...(event === TechnologyEffectKind.ShipyardWorld
            ? { stock: Object.fromEntries(unitsInPlay.map((kind) => [kind, 1])) }
            : {})
    }

    return { orbited, event, everyone }
}

export type Salvaged = { piece: Piece; playerId: string }

// Where a destroyed probe or fighter goes: a salvage drone in reach takes it into its owner's bag
// (rules.md, Granted pieces); otherwise it is out of the game.
export function salvageDestroyed(
    state: HydratedEarendelGameState,
    destroyed: { piece: Piece; at: AxialCoordinates }[],
    destroyerId?: string
): Salvaged[] {
    const salvaged: Salvaged[] = []
    for (const { piece, at } of destroyed) {
        if (piece.type !== PieceType.Probe && piece.type !== PieceType.Fighter) continue
        const { torpedo: _torpedo, surveying: _surveying, ...rest } = piece
        const fresh: Piece = {
            ...rest,
            ...(piece.type === PieceType.Fighter && (piece.level ?? 2) < 2 ? { level: 2 } : {})
        }
        const claimant = salvageClaimant(state, at, destroyerId)
        if (!claimant) continue
        const salvage: Piece = {
            ...fresh,
            playerId: claimant,
            id: `${claimant}-salvaged-${piece.id}`
        }
        returnToBag(state.getPlayerState(claimant).bag, [salvage], state.getProtectedPrng().random)
        salvaged.push({ piece: salvage, playerId: claimant })
    }
    return salvaged
}
