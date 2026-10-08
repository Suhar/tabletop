import type { Point } from '@tabletop/common'
import type { RailroadId } from './railroads.js'

export enum SettlementKind {
    AgriculturalRailhead = 'AgriculturalRailhead',
    RailroadStation = 'RailroadStation',
    MercantileCenter = 'MercantileCenter',
    RailroadBase = 'RailroadBase',
    MetroArea = 'MetroArea'
}

export type SettlementDefinition = {
    id: string
    name: string
    kind: SettlementKind
    x: number
    y: number
    homeOf?: RailroadId
}

export type LinkDefinition = {
    id: string
    ends: readonly [string, string]
    box: Point
}

export type ExternalConnectionDefinition = {
    id: string
    name: string
    settlementId: string
    price: number
    value: number
    x: number
    y: number
}
