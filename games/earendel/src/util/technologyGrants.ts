import { assertExists, type AxialCoordinates, sameCoordinates } from '@tabletop/common'
import { getHex, neighborsOf } from '../model/board.js'
import { refreshPlanetControl } from './control.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { grantedPieceOf, storedEffectOf, TechnologyEffectKind } from '../model/technology.js'
import { technologyCard } from '../model/technologyCards.js'
import type { OrbitedProbe } from '../model/exploration.js'
import { probeLeaderOf } from './probes.js'
import { ruleInForce } from './rules.js'
import { quarantined } from './specials.js'
import { type Piece, PieceType } from '../model/pieces.js'

export function probeTechnologiesFor(
    state: HydratedEarendelGameState,
    playerId: string
): { gained: string[]; lapsed: string[]; researched: AxialCoordinates[] } {
    const held = state.getPlayerState(playerId).technologies
    const gained: string[] = []
    const lapsed: string[] = []
    const researched: AxialCoordinates[] = []

    for (const claim of state.probeClaims) {
        if (claim.playerId !== playerId) continue
        const technologyId = getHex(state.board, claim.coords)?.technologyId
        if (technologyId !== claim.technologyId) continue
        if (held.includes(technologyId) || gained.includes(technologyId)) continue
        // A quarantined planet's claims wait, neither paying nor lapsing.
        if (quarantined(state.board, claim.coords)) continue

        if (probeLeaderOf(state.board, claim.coords) === playerId) {
            gained.push(technologyId)
            researched.push(claim.coords)
        } else {
            lapsed.push(technologyId)
        }
    }

    return { gained, lapsed, researched }
}

// The claimant's probes beside each researched planet leave the board for its orbit, out of the
// game. Every claim is judged first, so one planet's probes leaving cannot change another's result.
function sendProbesToOrbit(
    state: HydratedEarendelGameState,
    playerId: string,
    planets: AxialCoordinates[]
): OrbitedProbe[] {
    const orbited: OrbitedProbe[] = []
    for (const planet of planets) {
        const planetHex = getHex(state.board, planet)
        assertExists(planetHex, 'A researched planet must be on the board')
        for (const from of neighborsOf(planet)) {
            const hex = getHex(state.board, from)
            const probe = hex?.piece
            if (!hex || probe?.type !== PieceType.Probe || probe.playerId !== playerId) continue
            // A probe committed to another planet counts nothing here and stays where it is.
            if (probe.surveying && !sameCoordinates(probe.surveying, planet)) continue
            hex.piece = undefined
            planetHex.orbiters = [...(planetHex.orbiters ?? []), probe]
            orbited.push({ probe, from, planet })
        }
    }
    if (orbited.length > 0) refreshPlanetControl(state)
    return orbited
}

export function grantTechnology(
    state: HydratedEarendelGameState,
    playerId: string,
    technologyId: string
) {
    const card = technologyCard(technologyId)
    const playerState = state.getPlayerState(playerId)
    playerState.technologies.push(card.id)

    const stored = storedEffectOf(card)
    if (stored) playerState.storedEffects.push(stored)

    const granted = grantedPieceOf(card)
    if (granted) playerState.specialPieces.push(...grantedPieces(granted, playerId, card.id))
}

// The piece each technology grants; a gate pair comes from Gate Network, handled apart.
export const GRANTED_TYPES: Partial<Record<TechnologyEffectKind, PieceType>> = {
    [TechnologyEffectKind.RelayNetwork]: PieceType.Relay,
    [TechnologyEffectKind.Terraforming]: PieceType.Terraformer,
    [TechnologyEffectKind.Interdiction]: PieceType.Interdictor,
    [TechnologyEffectKind.BastionWorks]: PieceType.Bastion,
    [TechnologyEffectKind.CarrierDoctrine]: PieceType.Carrier,
    [TechnologyEffectKind.DeepScan]: PieceType.DeepScanner,
    [TechnologyEffectKind.Quarantine]: PieceType.QuarantineBeacon,
    [TechnologyEffectKind.JammerArray]: PieceType.Jammer,
    [TechnologyEffectKind.ArtificialWorld]: PieceType.ArtificialPlanet,
    [TechnologyEffectKind.NebulaSeeding]: PieceType.NebulaSeeder,
    [TechnologyEffectKind.SalvageOperations]: PieceType.SalvageDrone
}

// The pieces a technology grants (rules.md, Granted pieces): one, or a gate pair.
export function grantedPieces(
    kind: TechnologyEffectKind,
    playerId: string,
    technologyId: string
): Piece[] {
    if (kind === TechnologyEffectKind.StationUpgrade) {
        return [
            { id: `${playerId}-hub-${technologyId}`, playerId, type: PieceType.Station, hub: true }
        ]
    }
    if (kind === TechnologyEffectKind.GateNetwork) {
        const pairId = `${playerId}-gates-${technologyId}`
        return [1, 2].map((n) => ({
            id: `${pairId}-${n}`,
            playerId,
            type: PieceType.Gate,
            pairId
        }))
    }
    const type = GRANTED_TYPES[kind]
    if (!type) return []
    return [{ id: `${playerId}-${type}-${technologyId}`, playerId, type }]
}

export type SharedTechnology = { playerId: string; technologyId: string }

export function claimProbeTechnologies(
    state: HydratedEarendelGameState,
    playerId: string
): { gained: string[]; lapsed: string[]; orbited: OrbitedProbe[]; shared: SharedTechnology[] } {
    const { gained, lapsed, researched } = probeTechnologiesFor(state, playerId)
    // Settled claims are spent; a quarantined one waits for the beacon to go.
    state.probeClaims = state.probeClaims.filter(
        (claim) => claim.playerId !== playerId || quarantined(state.board, claim.coords)
    )
    const orbited = sendProbesToOrbit(state, playerId, researched)

    const shared: SharedTechnology[] = []

    gained.forEach((technologyId, index) => {
        grantTechnology(state, playerId, technologyId)

        // Shared Science (rules.md, Elevated technologies): the moment the claimant's probes go
        // into orbit, every rival with a probe beside the planet learns the technology too.
        if (ruleInForce(state.board, TechnologyEffectKind.SharedScience)) {
            for (const rivalId of probeOwnersBeside(state, researched[index], playerId)) {
                if (state.getPlayerState(rivalId).technologies.includes(technologyId)) continue
                grantTechnology(state, rivalId, technologyId)
                shared.push({ playerId: rivalId, technologyId })
            }
        }
    })

    return { gained, lapsed, orbited, shared }
}

function probeOwnersBeside(
    state: HydratedEarendelGameState,
    planet: AxialCoordinates,
    except: string
): string[] {
    const owners = new Set<string>()
    for (const neighbor of neighborsOf(planet)) {
        const piece = getHex(state.board, neighbor)?.piece
        if (piece?.type === PieceType.Probe && piece.playerId !== except) owners.add(piece.playerId)
    }
    return [...owners]
}
