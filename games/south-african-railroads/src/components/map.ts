import { EXTERNAL_CONNECTIONS, LINKS, SETTLEMENTS } from './mapData.js'
import {
    SettlementKind,
    type ExternalConnectionDefinition,
    type LinkDefinition,
    type SettlementDefinition
} from './mapTypes.js'

export const JOHANNESBURG = 'johannesburg'
export const BLOEMFONTEIN = 'bloemfontein'

const INCOME_BY_KIND: Record<
    Exclude<SettlementKind, SettlementKind.MetroArea>,
    readonly number[]
> = {
    [SettlementKind.AgriculturalRailhead]: [1, 5],
    [SettlementKind.RailroadStation]: [1, 2],
    [SettlementKind.MercantileCenter]: [2, 4],
    [SettlementKind.RailroadBase]: [3, 6]
}

const METRO_INCOME: Record<string, readonly number[]> = {
    [BLOEMFONTEIN]: [3, 4, 5, 6],
    [JOHANNESBURG]: [2, 3, 4, 5, 6, 7, 8, 9, 10]
}

const settlementsById = new Map(SETTLEMENTS.map((settlement) => [settlement.id, settlement]))
const linksById = new Map(LINKS.map((link) => [link.id, link]))
const connectionsById = new Map(
    EXTERNAL_CONNECTIONS.map((connection) => [connection.id, connection])
)

export function settlement(id: string): SettlementDefinition {
    const found = settlementsById.get(id)
    if (!found) {
        throw Error(`Unknown settlement ${id}`)
    }
    return found
}

export function link(id: string): LinkDefinition {
    const found = linksById.get(id)
    if (!found) {
        throw Error(`Unknown track link ${id}`)
    }
    return found
}

export function externalConnection(id: string): ExternalConnectionDefinition {
    const found = connectionsById.get(id)
    if (!found) {
        throw Error(`Unknown external connection ${id}`)
    }
    return found
}

export function linksAt(settlementId: string): LinkDefinition[] {
    return LINKS.filter((candidate) => candidate.ends.includes(settlementId))
}

export function otherEnd(trackLink: LinkDefinition, settlementId: string): string {
    return trackLink.ends[0] === settlementId ? trackLink.ends[1] : trackLink.ends[0]
}

export function incomeLevels(settlementId: string): readonly number[] {
    const kind = settlement(settlementId).kind
    if (kind === SettlementKind.MetroArea) {
        const levels = METRO_INCOME[settlementId]
        if (!levels) {
            throw Error(`No income track for metro area ${settlementId}`)
        }
        return levels
    }
    return INCOME_BY_KIND[kind]
}

export function maxDevelopments(settlementId: string): number {
    return incomeLevels(settlementId).length - 1
}
