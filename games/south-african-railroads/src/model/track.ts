import { EXTERNAL_CONNECTIONS, LINKS } from '../components/mapData.js'
import { JOHANNESBURG, externalConnection, link, otherEnd } from '../components/map.js'
import type { ExternalConnectionDefinition } from '../components/mapTypes.js'
import type { RailroadId } from '../components/railroads.js'
import type { BuiltConnection, BuiltLink } from './railroadState.js'

export const LINK_COST = 5
export const DOUBLE_LINK_COST = 15
export const LINK_VALUE = 5

export type TrackState = {
    track: readonly BuiltLink[]
    connections: readonly BuiltConnection[]
}

export type DoubleBuild = readonly [string, string]

export function railroadLinkIds(state: TrackState, railroadId: RailroadId): string[] {
    return state.track
        .filter((built) => built.railroadId === railroadId)
        .map((built) => built.linkId)
}

export function railroadConnectionIds(state: TrackState, railroadId: RailroadId): string[] {
    return state.connections
        .filter((built) => built.railroadId === railroadId)
        .map((built) => built.connectionId)
}

export function railroadSettlements(state: TrackState, railroadId: RailroadId): Set<string> {
    return new Set(railroadLinkIds(state, railroadId).flatMap((linkId) => link(linkId).ends))
}

export function isLinkBuilt(state: TrackState, linkId: string): boolean {
    return state.track.some((built) => built.linkId === linkId)
}

export function isSettlementConnected(state: TrackState, settlementId: string): boolean {
    return state.track.some((built) => link(built.linkId).ends.includes(settlementId))
}

export function linkOwner(state: TrackState, linkId: string): RailroadId | undefined {
    return state.track.find((built) => built.linkId === linkId)?.railroadId
}

export function singleBuilds(state: TrackState, railroadId: RailroadId): string[] {
    const network = railroadSettlements(state, railroadId)
    return LINKS.filter(
        (candidate) =>
            !isLinkBuilt(state, candidate.id) && candidate.ends.some((end) => network.has(end))
    ).map((candidate) => candidate.id)
}

// Two consecutive links into settlements the railroad has not reached, never passing through
// Johannesburg.
export function doubleBuilds(state: TrackState, railroadId: RailroadId): DoubleBuild[] {
    const network = railroadSettlements(state, railroadId)
    const builds: DoubleBuild[] = []
    for (const firstId of singleBuilds(state, railroadId)) {
        const first = link(firstId)
        for (const middle of first.ends) {
            if (network.has(middle) || middle === JOHANNESBURG) {
                continue
            }
            for (const second of LINKS) {
                const end = second.ends.includes(middle) ? otherEnd(second, middle) : undefined
                if (
                    end !== undefined &&
                    second.id !== firstId &&
                    !isLinkBuilt(state, second.id) &&
                    !network.has(end)
                ) {
                    builds.push([firstId, second.id])
                }
            }
        }
    }
    return builds
}

export function isDoubleBuild(
    state: TrackState,
    railroadId: RailroadId,
    linkIds: readonly string[]
): boolean {
    return doubleBuilds(state, railroadId).some(
        ([first, second]) => first === linkIds[0] && second === linkIds[1]
    )
}

export function connectionBuilds(
    state: TrackState,
    railroadId: RailroadId
): ExternalConnectionDefinition[] {
    const network = railroadSettlements(state, railroadId)
    return EXTERNAL_CONNECTIONS.filter(
        (connection) =>
            network.has(connection.settlementId) &&
            !state.connections.some((built) => built.connectionId === connection.id)
    )
}

export function homeLinks(state: TrackState, settlementId: string): string[] {
    return LINKS.filter(
        (candidate) => candidate.ends.includes(settlementId) && !isLinkBuilt(state, candidate.id)
    ).map((candidate) => candidate.id)
}

export function trackValue(state: TrackState, railroadId: RailroadId): number {
    return (
        railroadLinkIds(state, railroadId).length * LINK_VALUE +
        railroadConnectionIds(state, railroadId).reduce(
            (sum, connectionId) => sum + externalConnection(connectionId).value,
            0
        )
    )
}
