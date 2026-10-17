import type { Color, Point } from '@tabletop/common'

export enum MapId {
    SouthAfrica = 'SouthAfrica',
    TexasSpecial = 'TexasSpecial'
}

export enum RailroadId {
    CdFM = 'CdFM',
    CSAR = 'CSAR',
    NRC = 'NRC',
    CTRD = 'CTRD',
    CMRC = 'CMRC',
    ZASM = 'ZASM',
    MKT = 'MKT',
    MP = 'MP',
    SP = 'SP',
    GHH = 'GHH',
    SLSF = 'SLSF',
    TP = 'TP'
}

export enum SettlementKind {
    AgriculturalRailhead = 'AgriculturalRailhead',
    RailroadStation = 'RailroadStation',
    MercantileCenter = 'MercantileCenter',
    RailroadBase = 'RailroadBase',
    NaturalResource = 'NaturalResource',
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

// A one-off founding that joins a northern and a southern railroad whose track meets.
export type SpecialConnectionDefinition = {
    name: string
    northern: readonly RailroadId[]
    southern: readonly RailroadId[]
    cost: number
    // Added to each founding railroad's value for the final payoff only.
    valueBonus: number
}

export type MapDefinition = {
    id: MapId
    name: string
    railroads: readonly RailroadDefinition[]
    // Auctioned in this order at the start; every other railroad opens once track reaches its home.
    initialOffering: readonly RailroadId[]
    startPlayerRailroad: RailroadId
    // A double build may not run into and out of this settlement.
    doubleBuildBarrierId: string
    // A metro area developed without a connection, and free as the second development.
    freeDevelopmentId?: string
    // Declining the paid second development, or leaving town, develops the first of these that
    // is not full.
    automaticDevelopment: readonly string[]
    // Develop Settlements may instead take a development cube back to the player's own area.
    leaveTown: boolean
    specialConnection?: SpecialConnectionDefinition
    settlements: readonly SettlementDefinition[]
    links: readonly LinkDefinition[]
    externalConnections: readonly ExternalConnectionDefinition[]
    settlementIncome: Readonly<Partial<Record<PointSettlementKind, readonly number[]>>>
    metroIncome: Readonly<Record<string, readonly number[]>>
    startingCash: Readonly<Record<number, number>>
    offerStockSlots: Readonly<Record<number, number>>
}
