import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { PassableBidding } from '@tabletop/18xx'
import { MachineState } from '../definition/states.js'
import { sarMap, type SarMap } from '../maps/maps.js'
import { MapId, RailroadId } from '../maps/types.js'
import {
    ACTION_BOXES,
    ACTION_TRACK_ADVANCE,
    ACTION_TRACK_LIMIT,
    ActionBox,
    boxCapacity
} from './actionBoxes.js'
import { ShareAuction } from './auction.js'
import {
    developmentIncomeGains,
    developmentLevel,
    dividendPerShare,
    linkIncome,
    finalPayoffPerShare,
    SHARES_PER_RAILROAD,
    minimumBid,
    railroadIncome,
    settlementIncome,
    specialDividendPerShare,
    type IncomeGain
} from './economy.js'
import { HydratedSarPlayerState, SarPlayerState } from './playerState.js'
import { BuiltConnection, BuiltLink, RailroadState } from './railroadState.js'
import {
    DOUBLE_LINK_COST,
    LINK_COST,
    connectionBuilds,
    doubleBuilds,
    isSettlementConnected,
    singleBuilds,
    trackValue
} from './track.js'
import { Delegation, FreeBuildDue } from './turn.js'

export const SECOND_DEVELOPMENT_COST = 3
export const DIVIDENDS_BEFORE_FINAL = 5
export const ROUNDS = DIVIDENDS_BEFORE_FINAL + 1

export type SarGameState = Type.Static<typeof SarGameState>
export const SarGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(SarPlayerState),
    machineState: Type.Enum(MachineState),
    mapId: Type.Enum(MapId),
    railroads: Type.Array(RailroadState),
    track: Type.Array(BuiltLink),
    connections: Type.Array(BuiltConnection),
    developments: Type.Record(Type.String(), Type.Number()),
    actionTrack: Type.Number(),
    dividendsPaid: Type.Number(),
    developmentsThisTurn: Type.Number(),
    auction: Type.Optional(ShareAuction),
    freeBuild: Type.Optional(FreeBuildDue),
    delegation: Type.Optional(Delegation)
})

export const SarGameStateValidator = Compile(SarGameState)

export type ShareHolding = { railroadId: RailroadId; shares: number }

export class HydratedSarGameState
    extends HydratableGameState<typeof SarGameState, HydratedSarPlayerState>
    implements SarGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedSarPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare mapId: MapId
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare railroads: RailroadState[]
    declare track: BuiltLink[]
    declare connections: BuiltConnection[]
    declare developments: Record<string, number>
    declare actionTrack: number
    declare dividendsPaid: number
    declare developmentsThisTurn: number
    declare auction?: ShareAuction
    declare freeBuild?: FreeBuildDue
    declare delegation?: Delegation

    constructor(data: SarGameState) {
        super(data, SarGameStateValidator)
        this.players = data.players.map((player) => new HydratedSarPlayerState(player))
    }

    get map(): SarMap {
        return sarMap(this.mapId)
    }

    railroad(railroadId: RailroadId): RailroadState {
        const railroad = this.railroads.find((candidate) => candidate.id === railroadId)
        assertExists(railroad, `Unknown railroad ${railroadId}`)
        return railroad
    }

    openRailroads(): RailroadState[] {
        return this.railroads.filter((railroad) => railroad.open)
    }

    nextInitialOffering(): RailroadId | undefined {
        return this.map.initialOffering.find((railroadId) => !this.railroad(railroadId).open)
    }

    turnPlayerId(): string {
        const playerId = this.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'No turn in progress')
        return playerId
    }

    settlementIncome(settlementId: string): number {
        return settlementIncome(this, settlementId)
    }

    developmentLevel(settlementId: string): number {
        return developmentLevel(this, settlementId)
    }

    buildIncomeGain(linkId: string): number {
        return linkIncome(this, linkId)
    }

    developmentIncomeGains(settlementId: string): IncomeGain[] {
        return developmentIncomeGains(this, settlementId)
    }

    income(railroadId: RailroadId): number {
        return railroadIncome(this, railroadId)
    }

    value(railroadId: RailroadId): number {
        return trackValue(this, railroadId)
    }

    minimumBid(railroadId: RailroadId): number {
        return minimumBid(this.value(railroadId))
    }

    sharesHeld(railroadId: RailroadId, playerId: string): number {
        return this.railroad(railroadId).owners.filter((owner) => owner === playerId).length
    }

    unsoldShares(railroadId: RailroadId): number {
        return SHARES_PER_RAILROAD - this.railroad(railroadId).owners.length
    }

    holdings(playerId: string): ShareHolding[] {
        return this.map.railroads
            .map((railroad) => ({
                railroadId: railroad.id,
                shares: this.sharesHeld(railroad.id, playerId)
            }))
            .filter((holding) => holding.shares > 0)
    }

    controllers(railroadId: RailroadId): string[] {
        const counts = this.players.map((player) => ({
            playerId: player.playerId,
            shares: this.sharesHeld(railroadId, player.playerId)
        }))
        const most = Math.max(...counts.map((count) => count.shares))
        return most === 0
            ? []
            : counts.filter((count) => count.shares === most).map((count) => count.playerId)
    }

    controls(railroadId: RailroadId, playerId: string): boolean {
        return this.controllers(railroadId).includes(playerId)
    }

    locomotivesIn(box: ActionBox, exceptPlayerId?: string): number {
        return this.players.filter(
            (player) => player.locomotive === box && player.playerId !== exceptPlayerId
        ).length
    }

    availableBoxes(playerId: string): ActionBox[] {
        const player = this.getPlayerState(playerId)
        return ACTION_BOXES.filter(
            (box) =>
                (box === ActionBox.ConstructTrack || box !== player.locomotive) &&
                this.locomotivesIn(box, playerId) < this.boxCapacity(box)
        )
    }

    // Choosing the box pays dividends at once: Pay Dividends, or a box whose advance takes the
    // action track past its limit.
    triggersDividends(box: ActionBox): boolean {
        return (
            box === ActionBox.PayDividends ||
            this.actionTrack + ACTION_TRACK_ADVANCE[box] > ACTION_TRACK_LIMIT
        )
    }

    boxCapacity(box: ActionBox): number {
        return boxCapacity(box, this.players.length, this.map)
    }

    singleBuilds(railroadId: RailroadId): string[] {
        return this.railroad(railroadId).treasury >= LINK_COST ? singleBuilds(this, railroadId) : []
    }

    doubleBuilds(railroadId: RailroadId) {
        return this.railroad(railroadId).treasury >= DOUBLE_LINK_COST
            ? doubleBuilds(this, railroadId)
            : []
    }

    connectionBuilds(railroadId: RailroadId) {
        const treasury = this.railroad(railroadId).treasury
        return connectionBuilds(this, railroadId).filter(
            (connection) => connection.price <= treasury
        )
    }

    canBuild(railroadId: RailroadId): boolean {
        return (
            this.railroad(railroadId).open &&
            (this.singleBuilds(railroadId).length > 0 ||
                this.connectionBuilds(railroadId).length > 0)
        )
    }

    buildableRailroads(): RailroadId[] {
        return this.map.railroads
            .map((railroad) => railroad.id)
            .filter((railroadId) => this.canBuild(railroadId))
    }

    // The railroads the acting player may build with directly; empty when they must hand the
    // build to the controller of another railroad.
    ownBuildableRailroads(playerId: string): RailroadId[] {
        return this.buildableRailroads().filter((railroadId) => this.controls(railroadId, playerId))
    }

    builderRailroads(playerId: string): RailroadId[] {
        if (this.delegation) {
            return this.delegation.builderId === playerId ? [this.delegation.railroadId] : []
        }
        return this.ownBuildableRailroads(playerId)
    }

    // A closed railroad outside the initial offering opens once track reaches its home.
    railroadOpenedBy(linkIds: readonly string[]): RailroadId | undefined {
        const reached = new Set(linkIds.flatMap((linkId) => this.map.link(linkId).ends))
        return this.map.railroads.find(
            (railroad) =>
                !this.map.opensInInitialOffering(railroad.id) &&
                !this.railroad(railroad.id).open &&
                reached.has(railroad.homeId)
        )?.id
    }

    developableSettlements(): string[] {
        return this.map.settlements
            .filter(
                (candidate) =>
                    this.developmentLevel(candidate.id) < this.map.maxDevelopments(candidate.id) &&
                    (candidate.id === this.map.hubId || isSettlementConnected(this, candidate.id))
            )
            .map((candidate) => candidate.id)
    }

    developmentCost(settlementId: string): number {
        return this.developmentsThisTurn === 0 || settlementId === this.map.hubId
            ? 0
            : SECOND_DEVELOPMENT_COST
    }

    affordableDevelopments(playerId: string): string[] {
        const cash = this.getPlayerState(playerId).cash
        return this.developableSettlements().filter(
            (settlementId) => this.developmentCost(settlementId) <= cash
        )
    }

    // A second development is optional only when the hub cannot take it for free.
    mayFinishDeveloping(): boolean {
        return (
            this.developmentsThisTurn === 1 &&
            !this.developableSettlements().includes(this.map.hubId)
        )
    }

    settlementName(settlementId: string): string {
        return this.map.settlement(settlementId).name
    }

    bidding(): PassableBidding {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        return new PassableBidding(auction.bidding)
    }

    smallestBid(): number {
        const auction = this.auction
        assertExists(auction, 'No auction in progress')
        const bidding = new PassableBidding(auction.bidding)
        return bidding.hasBid ? bidding.highBid + 1 : auction.minimum
    }

    unsoldOffers(): RailroadId[] {
        return this.openRailroads()
            .filter((railroad) => this.unsoldShares(railroad.id) > 0)
            .map((railroad) => railroad.id)
    }

    dividendPerShare(railroadId: RailroadId): number {
        return dividendPerShare(this.income(railroadId))
    }

    specialDividendPerShare(railroadId: RailroadId): number {
        return specialDividendPerShare(this.income(railroadId))
    }

    finalPayoffPerShare(railroadId: RailroadId): number {
        return finalPayoffPerShare(
            this.value(railroadId),
            this.income(railroadId),
            this.railroad(railroadId).owners.length
        )
    }

    // Each round ends in a payout; the last ends in the final payoff.
    round(): number {
        return Math.min(this.dividendsPaid, DIVIDENDS_BEFORE_FINAL) + 1
    }

    isFinalPayoffNext(): boolean {
        return this.dividendsPaid >= DIVIDENDS_BEFORE_FINAL
    }

    // What the next dividend pays per share at current incomes; the sixth is the final payoff.
    nextDividendPerShare(railroadId: RailroadId): number {
        return this.isFinalPayoffNext()
            ? this.finalPayoffPerShare(railroadId)
            : this.dividendPerShare(railroadId)
    }

    nextDividend(playerId: string): number {
        return this.holdings(playerId).reduce(
            (sum, holding) => sum + holding.shares * this.nextDividendPerShare(holding.railroadId),
            0
        )
    }

    // Cash if the game ended now: the final payoff for every share held.
    projectedFinalCash(playerId: string): number {
        return (
            this.getPlayerState(playerId).cash +
            this.holdings(playerId).reduce(
                (sum, holding) =>
                    sum + holding.shares * this.finalPayoffPerShare(holding.railroadId),
                0
            )
        )
    }
}
