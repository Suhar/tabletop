import type { Color, Point } from '@tabletop/common'

export enum MapId {
    SouthAfrica = 'SouthAfrica'
}

export enum RailroadId {
    CdFM = 'CdFM',
    CSAR = 'CSAR',
    NRC = 'NRC',
    CTRD = 'CTRD',
    CMRC = 'CMRC',
    ZASM = 'ZASM'
}

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

export type RailroadDefinition = {
    id: RailroadId
    shortName: string
    name: string
    color: Color
    homeId: string
}

export type PointSettlementKind = Exclude<SettlementKind, SettlementKind.MetroArea>

export type MapDefinition = {
    id: MapId
    name: string
    railroads: readonly RailroadDefinition[]
    // Auctioned in this order at the start; every other railroad opens once track reaches its home.
    initialOffering: readonly RailroadId[]
    startPlayerRailroad: RailroadId
    // The metro area developed for free and without a connection, as the second development when
    // the player will not pay, and never passed through by a double build.
    hubId: string
    settlements: readonly SettlementDefinition[]
    links: readonly LinkDefinition[]
    externalConnections: readonly ExternalConnectionDefinition[]
    settlementIncome: Readonly<Record<PointSettlementKind, readonly number[]>>
    metroIncome: Readonly<Record<string, readonly number[]>>
    startingCash: Readonly<Record<number, number>>
    offerStockSlots: Readonly<Record<number, number>>
}
