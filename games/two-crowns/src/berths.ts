import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    RailwayMapState,
    TrackNetwork,
    cashOwnedBy,
    closePrivate,
    controllingOwner,
    getCompany,
    privateOwner,
    routeRevenue,
    sameOwner,
    settleCashPayments,
    type MapStateData,
    type Owner,
    type RevenueCenter,
    type RouteRevenuePolicy,
    type TrainRunningState
} from '@tabletop/18xx'
import { TwoCrownsMap } from './map.js'
import { TwoCrownsTileSet } from './tiles.js'
import { TwoCrownsPhases } from './trains.js'
import type { TwoCrownsState } from './state.js'

// 1874design.md, Berths: sea offboards and the Kvarner islands need a Berth to run to or through.
export const AnconaId = 'B16'
export const SeaLocationIds = [AnconaId, 'Q27', 'L28']
export const IslandLocationIds = ['F14', 'F16', 'G19']
export const RijekaId = 'F12'
export const BerthPrice = 80
export const OperatingTitleStates = ['LayingTrack', 'PlacingStation', 'BuyingTrains']

type BerthState = Pick<TwoCrownsState, 'berthCompanyIds' | 'anconaCompanyId'>
type OperatingState = MapStateData &
    BerthState & {
        machineState: string
        activePlayerIds: string[]
        players: { playerId: string }[]
    } & Parameters<typeof EighteenXXTransferTiming.operatingCompany>[0] &
    Parameters<typeof cashOwnedBy>[0]

export function hasBerth(state: BerthState, companyId: string): boolean {
    return state.berthCompanyIds?.includes(companyId) ?? false
}
export function needsBerth(locationId: string): boolean {
    return SeaLocationIds.includes(locationId) || IslandLocationIds.includes(locationId)
}
export function berthPrice(state: BerthState, companyId: string): number {
    return state.anconaCompanyId === companyId ? BerthPrice / 2 : BerthPrice
}

/** Whether a route from one of the company's stations reaches Rijeka. */
export function reachesRijeka(state: MapStateData, companyId: string): boolean {
    const mapState = new RailwayMapState(TwoCrownsMap, TwoCrownsTileSet, state.tileInventory)
    const rijeka = mapState.tile(RijekaId).face.nodes.filter((node) => node.kind === 'city')
    return state.stations.some((station) => {
        if (station.status !== 'placed' || station.companyId !== companyId) return false
        if (station.position.locationId === RijekaId) return true
        const network = new TrackNetwork(mapState, state, companyId, undefined, station.position)
        return rijeka.some((node) => network.reaches(RijekaId, { kind: 'node', nodeId: node.id }))
    })
}

// The operating company the acting player may act for during its turn, if any.
function actingCompany(state: OperatingState, playerId: string): string | undefined {
    if (!OperatingTitleStates.includes(state.machineState)) return undefined
    if (!state.activePlayerIds.includes(playerId)) return undefined
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    if (!companyId || companyId === 'LUKA') return undefined
    return controllingOwner(state, companyId)?.playerId === playerId ? companyId : undefined
}

export function berthPurchaseReason(
    state: OperatingState,
    playerId: string,
    companyId: string
): string | undefined {
    if (actingCompany(state, playerId) !== companyId)
        return 'A company buys a Berth during its own operating turn.'
    if (hasBerth(state, companyId)) return 'The company already owns a Berth.'
    if ((state.berthCompanyIds?.length ?? 0) >= state.players.length)
        return 'Every Berth has been sold.'
    const cash = cashOwnedBy(state, { kind: 'company', companyId })
    if (typeof cash !== 'number' || cash < berthPrice(state, companyId))
        return 'The company cannot afford a Berth.'
    if (!reachesRijeka(state, companyId)) return 'The company needs a route to Rijeka.'
    return undefined
}

export const BuyBerth = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyBerth'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                { price: Type.Integer({ minimum: 0 }), recipient: Type.String() },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type BuyBerth = Type.Static<typeof BuyBerth>
const BerthValidator = Compile(BuyBerth)
export function isBuyBerth(action: GameAction): action is BuyBerth {
    return (
        action instanceof HydratedBuyBerth ||
        (action.type === 'BuyBerth' && BerthValidator.Check(action))
    )
}
export class HydratedBuyBerth extends HydratableAction<typeof BuyBerth> implements BuyBerth {
    declare type: 'BuyBerth'
    declare playerId: string
    declare companyId: string
    declare metadata?: BuyBerth['metadata']
    constructor(data: BuyBerth) {
        super(data instanceof HydratedBuyBerth ? data.dehydrate() : data, BerthValidator)
    }
    isValid(state: OperatingState): boolean {
        return (
            this.source === ActionSource.User &&
            !berthPurchaseReason(state, this.playerId, this.companyId)
        )
    }
    apply(state: HydratedGameState & OperatingState): void {
        assert(this.isValid(state), 'The company cannot buy a Berth')
        const price = berthPrice(state, this.companyId)
        // Berth fees go to the Luka until its last company floats (1874design.md, Berths).
        const luka = getCompany(state, 'LUKA')
        const recipient: Owner = luka.closed
            ? { kind: 'bank' }
            : { kind: 'company', companyId: 'LUKA' }
        settleCashPayments(state, [
            { from: { kind: 'company', companyId: this.companyId }, to: recipient, amount: price }
        ])
        state.berthCompanyIds = [...(state.berthCompanyIds ?? []), this.companyId]
        this.metadata = { price, recipient: recipient.kind === 'bank' ? 'bank' : 'LUKA' }
    }
}

// The Ancona Steamship Line (P17): once, its owner assigns it to a company they preside.
export function anconaAssignmentReason(
    state: OperatingState,
    playerId: string,
    companyId: string
): string | undefined {
    const line = state.companies.find((company) => company.id === 'P17')
    if (!line || line.closed) return 'The Ancona Steamship Line is not open.'
    const owner = privateOwner(state, 'P17')
    if (!owner || !sameOwner(owner, { kind: 'player', playerId }))
        return 'You do not own the Ancona Steamship Line.'
    if (actingCompany(state, playerId) !== companyId)
        return 'Assign it during the company’s operating turn.'
    return undefined
}

export const AssignAncona = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AssignAncona'),
        companyId: Type.String()
    },
    { additionalProperties: false }
)
export type AssignAncona = Type.Static<typeof AssignAncona>
const AnconaValidator = Compile(AssignAncona)
export function isAssignAncona(action: GameAction): action is AssignAncona {
    return (
        action instanceof HydratedAssignAncona ||
        (action.type === 'AssignAncona' && AnconaValidator.Check(action))
    )
}
export class HydratedAssignAncona
    extends HydratableAction<typeof AssignAncona>
    implements AssignAncona
{
    declare type: 'AssignAncona'
    declare playerId: string
    declare companyId: string
    constructor(data: AssignAncona) {
        super(data instanceof HydratedAssignAncona ? data.dehydrate() : data, AnconaValidator)
    }
    isValid(state: OperatingState): boolean {
        return (
            this.source === ActionSource.User &&
            !anconaAssignmentReason(state, this.playerId, this.companyId)
        )
    }
    apply(state: HydratedGameState & OperatingState): void {
        assert(this.isValid(state), 'The Ancona Steamship Line cannot be assigned')
        state.anconaCompanyId = this.companyId
        closePrivate(state, 'P17')
    }
}

// Every stop's printed value now, for the Ancona bonus's "largest other stop".
function stopValues(state: TrainRunningState): Record<string, number> {
    const mapState = new RailwayMapState(TwoCrownsMap, TwoCrownsTileSet, state.tileInventory)
    const stages = TwoCrownsPhases.phase(state.phaseId).tileColors
    const values: Record<string, number> = {}
    for (const location of TwoCrownsMap.definition.locations) {
        if (location.id === AnconaId) continue
        const amounts = mapState
            .tile(location.id)
            .face.nodes.flatMap((node) =>
                'revenue' in node && node.revenue ? [routeRevenue(node.revenue, stages)] : []
            )
        if (amounts.length) values[location.id] = Math.max(...amounts)
    }
    return values
}

export const BerthRouteRules = {
    stopAllowed: (state: TrainRunningState, companyId: string, center: RevenueCenter) =>
        !needsBerth(center.locationId) || hasBerth(state as BerthState, companyId),
    // The assigned company's routes to Ancona add the largest other stop (P17).
    revenuePolicy(
        _train: unknown,
        state?: TrainRunningState,
        companyId?: string
    ): RouteRevenuePolicy {
        if (!state || !companyId || (state as BerthState).anconaCompanyId !== companyId) return {}
        return {
            connectionBonuses: [{ from: { [AnconaId]: 0 }, to: stopValues(state), sourceId: 'P17' }]
        }
    }
}
