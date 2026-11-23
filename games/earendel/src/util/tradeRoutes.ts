import { Compile } from 'typebox/compile'
import * as Type from 'typebox'
import type { AxialCoordinates } from '@tabletop/common'
import { getHex, HexKind, planetCoordinates, type PlanetColor } from '../model/board.js'
import { RouteChangeMetadata, type TradeRoute } from '../model/chains.js'
import type { HydratedEarendelGameState } from '../model/gameState.js'
import { chainLengthBetween, planetPairKey } from './chains.js'

type PlanetPair = { planets: [AxialCoordinates, AxialCoordinates]; color: PlanetColor }

function sameColorPlanetPairs(state: HydratedEarendelGameState): PlanetPair[] {
    const byColor = new Map<PlanetColor, AxialCoordinates[]>()
    for (const coords of planetCoordinates(state.board)) {
        const color = getHex(state.board, coords)?.color
        if (color === undefined) continue
        byColor.set(color, [...(byColor.get(color) ?? []), coords])
    }

    const pairs: PlanetPair[] = []
    for (const [color, planets] of byColor) {
        for (let i = 0; i < planets.length; i++) {
            for (let j = i + 1; j < planets.length; j++) {
                pairs.push({ planets: [planets[i], planets[j]], color })
            }
        }
    }
    return pairs
}

function stillStands(state: HydratedEarendelGameState, route: TradeRoute): boolean {
    const [from, to] = route.planets.map((coords) => getHex(state.board, coords))
    return (
        from?.kind === HexKind.Planet &&
        to?.kind === HexKind.Planet &&
        from.color !== undefined &&
        from.color === to.color &&
        chainLengthBetween(state.board, route.playerId, ...route.planets) !== undefined
    )
}

// Ends every route whose owner no longer has a chain on its pair, then gives each pair without a
// route to the one player with a chain joining it, if there is exactly one (rules.md, Chains and
// trade routes). An unpaid route is the opening station's (rules.md, Setup).
export function settleTradeRoutes(
    state: HydratedEarendelGameState,
    { unpaid = false }: { unpaid?: boolean } = {}
) {
    state.tradeRoutes = state.tradeRoutes.filter((route) => stillStands(state, route))
    const held = new Set(state.tradeRoutes.map((route) => planetPairKey(...route.planets)))

    for (const { planets, color } of sameColorPlanetPairs(state)) {
        const pairKey = planetPairKey(...planets)
        if (held.has(pairKey)) continue

        const chains = state.players.flatMap((player) => {
            const length = chainLengthBetween(state.board, player.playerId, ...planets)
            return length === undefined ? [] : [{ playerId: player.playerId, length }]
        })
        if (chains.length !== 1) continue

        const [{ playerId, length }] = chains
        const points = unpaid ? 0 : length
        state.routesEstablished += 1
        state.tradeRoutes.push({
            id: `${pairKey}#${state.routesEstablished}`,
            planets,
            color,
            playerId,
            length,
            points
        })
        state.getPlayerState(playerId).score += points
    }
}

export type RouteChanges = { routesEstablished?: TradeRoute[]; routesBroken?: TradeRoute[] }

// The routes an action set up and ended, recorded so the history can say so without reading
// the board.
export function routeChanges(before: TradeRoute[], state: HydratedEarendelGameState): RouteChanges {
    const earlier = new Set(before.map((route) => route.id))
    const current = new Set(state.tradeRoutes.map((route) => route.id))
    const established = state.tradeRoutes.filter((route) => !earlier.has(route.id))
    const broken = before.filter((route) => !current.has(route.id))

    return {
        ...(established.length > 0 ? { routesEstablished: established } : {}),
        ...(broken.length > 0 ? { routesBroken: broken } : {})
    }
}

const RouteChangeMetadataValidator = Compile(Type.Object(RouteChangeMetadata))

// The routes any action's metadata says it set up or ended.
export function routeChangesOf(metadata: unknown): {
    established: TradeRoute[]
    broken: TradeRoute[]
} {
    if (!RouteChangeMetadataValidator.Check(metadata)) return { established: [], broken: [] }
    return {
        established: metadata.routesEstablished ?? [],
        broken: metadata.routesBroken ?? []
    }
}
