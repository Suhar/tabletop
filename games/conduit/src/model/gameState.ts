import {
    assert,
    assertExists,
    DrawBag,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedDrawBag,
    HydratedRoundManager,
    HydratedTurnManager,
    OffsetCoordinates,
    PrngState,
    RoundManager,
    sameCoordinates,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { Board, Grid, type PlacedStation, type Route } from './board.js'
import { ConduitPlayerState, HydratedConduitPlayerState } from './playerState.js'
import {
    AuctionSpots,
    BasePrice,
    BidTrackSpaces,
    CubesPerRound,
    extraCubesPrice,
    marketTiles,
    MaxExtraCubes,
    MinimumBids,
    Rounds
} from './rules.js'

export type StationStack = Type.Static<typeof StationStack>
export const StationStack = DrawBag(Type.Integer())

const StationStackValidator = Compile(StationStack)

export class HydratedStationStack
    extends HydratedDrawBag<number, typeof StationStack>
    implements StationStack
{
    constructor(data: StationStack) {
        super(data, StationStackValidator)
    }
}

// The printed auction-board space, 1 to 6 from the left. Bids run from the bottom of the track up.
export type MarketSpot = Type.Static<typeof MarketSpot>
export const MarketSpot = Type.Object({
    spot: Type.Integer({ minimum: 1, maximum: AuctionSpots }),
    tileId: Type.Optional(Type.Integer()),
    bids: Type.Array(Type.String()),
    buyerId: Type.Optional(Type.String())
})

export type Payment = Type.Static<typeof Payment>
export const Payment = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer()
})

export type StationRevenue = Type.Static<typeof StationRevenue>
export const StationRevenue = Type.Object({
    playerId: Type.String(),
    tileId: Type.Integer(),
    route: Type.Array(OffsetCoordinates),
    amount: Type.Integer(),
    bonuses: Type.Optional(Type.Array(Payment))
})

export interface Offer {
    spot: number
    tileId: number
    playerId: string
    price: number
}

// Designer ruling, 2026-11-25: when tied routes would pay bonuses to different players, the
// station's owner chooses one.
export type RouteOption = Type.Static<typeof RouteOption>
export const RouteOption = Type.Object({
    cells: Type.Array(OffsetCoordinates),
    // One entry per station passed.
    bonuses: Type.Array(Type.String())
})

export type RouteChoice = Type.Static<typeof RouteChoice>
export const RouteChoice = Type.Object({
    tileId: Type.Integer(),
    playerId: Type.String(),
    options: Type.Array(RouteOption),
    chosen: Type.Optional(Type.Array(OffsetCoordinates))
})

export interface PendingPlacement {
    spot: number
    tileId: number
    playerId: string
    faceUp: boolean
}

export type ConduitGameState = Type.Static<typeof ConduitGameState>
export const ConduitGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(ConduitPlayerState),
            machineState: Type.Enum(MachineState),
            roundManager: RoundManager,
            deck: StationStack,
            market: Type.Array(MarketSpot),
            board: Board,
            bidPasses: Type.Array(Type.String()),
            routeChoices: Type.Optional(Type.Array(RouteChoice))
        })
    ])
)

export const ConduitGameStateValidator = Compile(ConduitGameState)

export const ConduitProjectedState = Visibility.createProjectionSchema(ConduitGameState)
export type ConduitProjectedState = Type.Static<typeof ConduitProjectedState>
const ConduitProjectedStateValidator = Compile(ConduitProjectedState)

export class HydratedConduitGameState
    extends HydratableGameState<typeof ConduitProjectedState, HydratedConduitPlayerState>
    implements ConduitProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedConduitPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare roundManager: HydratedRoundManager
    declare deck: StationStack
    declare market: MarketSpot[]
    declare board: Board
    declare bidPasses: string[]
    declare routeChoices?: RouteChoice[]

    constructor(data: ConduitProjectedState) {
        super(data, ConduitProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedConduitPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
    }

    get round(): number {
        return this.roundManager.series.length
    }

    // Rules: after the fifth round, revenue and infrastructure loss repeat until no cubes remain.
    isPayingOut(): boolean {
        return this.round >= Rounds
    }

    startPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    grid(): Grid {
        return new Grid(this.board)
    }

    fillMarket(): number[] {
        this.roundManager.startRound(this.actionCount)
        const deck = new HydratedStationStack(this.deck)
        const count = marketTiles(this.players.length, this.round)
        assert(deck.remaining >= count, 'The stack has run out')
        const tileIds = Array.from({ length: count }, () => deck.draw())
        this.deck = deck.dehydrate()
        this.market = tileIds.map((tileId, index) => ({ spot: index + 1, tileId, bids: [] }))
        this.bidPasses = []
        return tileIds
    }

    bidsBy(playerId: string): number {
        return this.market.reduce(
            (total, spot) => total + spot.bids.filter((bidder) => bidder === playerId).length,
            0
        )
    }

    biddableSpots(): number[] {
        return this.market
            .filter((spot) => spot.tileId !== undefined && spot.bids.length < BidTrackSpaces)
            .map(({ spot }) => spot)
    }

    marketSpot(spot: number): MarketSpot {
        const found = this.market.find((candidate) => candidate.spot === spot)
        assertExists(found, `There is no spot ${spot} in the market`)
        return found
    }

    canBid(playerId: string): boolean {
        return (
            this.getPlayerState(playerId).supply > 0 &&
            this.biddableSpots().length > 0 &&
            !this.bidPasses.includes(playerId)
        )
    }

    // Designer ruling: a player with an empty supply is skipped.
    isBiddingOver(): boolean {
        return !this.players.some((player) => this.canBid(player.playerId))
    }

    canPassBid(playerId: string): boolean {
        return this.bidsBy(playerId) >= MinimumBids && this.canBid(playerId)
    }

    passBid(playerId: string) {
        this.bidPasses = [...this.bidPasses, playerId]
    }

    placeBid(playerId: string, spot: number) {
        assert(this.biddableSpots().includes(spot), `Spot ${spot} cannot take a bid`)
        this.getPlayerState(playerId).takeFromSupply(1)
        this.marketSpot(spot).bids.push(playerId)
    }

    private unresolvedSpot(): MarketSpot | undefined {
        return this.market.find((spot) => spot.tileId !== undefined)
    }

    currentOffer(): Offer | undefined {
        const unresolved = this.unresolvedSpot()
        if (!unresolved) {
            return undefined
        }
        const { spot, tileId, bids, buyerId } = unresolved
        if (tileId === undefined || buyerId !== undefined || bids.length === 0) {
            return undefined
        }
        return { spot, tileId, playerId: bids[0], price: BasePrice + bids.length }
    }

    // Rules: a tile nobody buys goes face down, placed by the Start Player.
    pendingPlacement(): PendingPlacement | undefined {
        const unresolved = this.unresolvedSpot()
        if (!unresolved) {
            return undefined
        }
        const { spot, tileId, bids, buyerId } = unresolved
        assertExists(tileId, 'An unresolved spot holds its tile')
        if (buyerId !== undefined) {
            return { spot, tileId, playerId: buyerId, faceUp: true }
        }
        if (bids.length === 0) {
            return { spot, tileId, playerId: this.startPlayerId(), faceUp: false }
        }
        return undefined
    }

    isResolutionOver(): boolean {
        return this.unresolvedSpot() === undefined
    }

    // Designer ruling: the buyer's other cubes go back to their supply.
    buyTile(playerId: string): Payment[] {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const buyer = this.getPlayerState(playerId)
        buyer.pay(offer.price)

        const spot = this.marketSpot(offer.spot)
        const [, ...others] = spot.bids
        const payments = new Map<string, number>()
        for (const bidderId of others) {
            payments.set(bidderId, (payments.get(bidderId) ?? 0) + 1)
            this.getPlayerState(bidderId).returnToSupply(1)
            if (bidderId !== playerId) {
                this.getPlayerState(bidderId).earn(1)
            }
        }
        spot.bids = []
        spot.buyerId = playerId
        return [...payments.entries()]
            .filter(([bidderId]) => bidderId !== playerId)
            .map(([bidderId, amount]) => ({ playerId: bidderId, amount }))
    }

    // Designer ruling: a pass takes back the passer's whole run of cubes, for one dollar.
    passTile(playerId: string): number {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const spot = this.marketSpot(offer.spot)
        const run = spot.bids.findIndex((bidderId) => bidderId !== playerId)
        const removed = run < 0 ? spot.bids.length : run
        spot.bids.splice(0, removed)
        const passer = this.getPlayerState(playerId)
        passer.returnToSupply(removed)
        passer.earn(1)
        return removed
    }

    canAfford(playerId: string): boolean {
        const offer = this.currentOffer()
        return offer !== undefined && this.getPlayerState(playerId).cash >= offer.price
    }

    placeTile(
        playerId: string,
        cell: OffsetCoordinates,
        rotation: number,
        extraCubes: number
    ): number {
        const placement = this.pendingPlacement()
        assertExists(placement, 'A tile is waiting to be placed')
        assert(placement.playerId === playerId, `Player ${playerId} is not placing the tile`)
        const face = { tileId: placement.tileId, rotation, faceUp: placement.faceUp }
        assert(this.grid().isLegalPlacement(face, cell), 'The tile cannot go there')
        assert(placement.faceUp || extraCubes === 0, 'A face-down tile takes no cubes')
        assert(extraCubes <= MaxExtraCubes, `At most ${MaxExtraCubes} extra cubes`)

        const station: PlacedStation = { cell, ...face, cubes: 0 }
        const extraPrice = placement.faceUp ? extraCubesPrice(extraCubes) : 0
        if (placement.faceUp) {
            const player = this.getPlayerState(playerId)
            assert(player.cash >= extraPrice, 'The player cannot pay for the extra cubes')
            player.pay(extraPrice)
            player.takeFromSupply(extraCubes)
            station.ownerId = playerId
            station.cubes = 1 + extraCubes
        }
        this.board.stations.push(station)
        const resolved = this.marketSpot(placement.spot)
        delete resolved.tileId
        delete resolved.buyerId
        resolved.bids = []
        return extraPrice
    }

    // Owners choose in turn order from the Start Player.
    findRouteChoices(): RouteChoice[] {
        const grid = this.grid()
        const choices: RouteChoice[] = []
        for (const station of this.ownedStations()) {
            const ownerId = station.ownerId
            if (ownerId === undefined) continue
            const options = new Map<string, RouteOption>()
            for (const route of grid.bestRoutes(station.cell)) {
                const bonuses = bonusPayees(grid, route.cells, ownerId).toSorted()
                const key = bonuses.join(',')
                if (!options.has(key)) options.set(key, { cells: route.cells, bonuses })
            }
            if (options.size > 1) {
                choices.push({
                    tileId: station.tileId,
                    playerId: ownerId,
                    options: [...options.values()]
                })
            }
        }
        const order = this.turnManager.turnOrder
        return choices.toSorted((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId))
    }

    pendingRouteChoice(): RouteChoice | undefined {
        return this.routeChoices?.find((choice) => choice.chosen === undefined)
    }

    routeOption(choice: RouteChoice, route: OffsetCoordinates[]): RouteOption | undefined {
        return choice.options.find((option) => this.sameRoute(option.cells, route))
    }

    chooseRoute(playerId: string, tileId: number, route: OffsetCoordinates[]): RouteOption {
        const choice = this.pendingRouteChoice()
        assertExists(choice, 'A route is waiting to be chosen')
        assert(choice.playerId === playerId, `Player ${playerId} is not choosing a route`)
        assert(choice.tileId === tileId, `Tile ${tileId} is not the route being chosen`)
        const option = this.routeOption(choice, route)
        assertExists(option, 'The route is one of the options')
        choice.chosen = option.cells
        return option
    }

    chosenRoutes(): Map<number, OffsetCoordinates[]> {
        return new Map(
            (this.routeChoices ?? []).flatMap((choice) =>
                choice.chosen === undefined ? [] : [[choice.tileId, choice.chosen] as const]
            )
        )
    }

    ownedStations(): PlacedStation[] {
        return this.board.stations.filter((station) => station.ownerId !== undefined)
    }

    payRevenue(): StationRevenue[] {
        const earnings = stationEarnings(this.board, this.chosenRoutes())
        this.routeChoices = undefined
        for (const { ownerId, amount, bonuses } of earnings) {
            this.getPlayerState(ownerId).earn(amount)
            for (const bonus of bonuses) {
                this.getPlayerState(bonus.playerId).earn(bonus.amount)
            }
        }
        return earnings.map(({ station, ownerId, route, amount, bonuses }) => ({
            playerId: ownerId,
            tileId: station.tileId,
            route: route?.cells ?? [],
            amount,
            ...(bonuses.length > 0 ? { bonuses } : {})
        }))
    }

    // Designer ruling: a station left without cubes stays face up and ownerless until the next
    // infrastructure loss. It earns nothing, but other routes count it and may end on it.
    loseInfrastructure(): number[] {
        const flipped = this.board.stations.filter(
            (station) => station.faceUp && station.cubes === 0
        )
        for (const station of flipped) {
            station.faceUp = false
            delete station.ownerId
        }
        for (const station of this.board.stations) {
            if (station.cubes === 0) continue
            station.cubes -= 1
            if (station.ownerId !== undefined) {
                this.getPlayerState(station.ownerId).retireCube()
            }
            if (station.cubes === 0) delete station.ownerId
        }
        return flipped.map((station) => station.tileId)
    }

    cubesOnBoard(): number {
        return this.board.stations.reduce((total, station) => total + station.cubes, 0)
    }

    endRound(): Payment[] {
        this.roundManager.endRound(this.actionCount)
        const refills = this.isPayingOut()
            ? []
            : this.players.map((player) => ({
                  playerId: player.playerId,
                  amount: player.refillSupply(CubesPerRound)
              }))
        this.turnManager.newFirstPlayer(this.turnManager.nextPlayer(this.startPlayerId()))
        return refills
    }

    leadingPlayerIds(): string[] {
        const rank = (player: HydratedConduitPlayerState) => [player.cash, player.supply]
        const best = this.players.reduce((leader, player) =>
            this.compareRanks(rank(player), rank(leader)) > 0 ? player : leader
        )
        return this.players
            .filter((player) => this.compareRanks(rank(player), rank(best)) === 0)
            .map((player) => player.playerId)
    }

    private sameRoute(a: OffsetCoordinates[], b: OffsetCoordinates[]): boolean {
        return a.length === b.length && a.every((cell, index) => sameCoordinates(cell, b[index]))
    }

    private compareRanks(a: number[], b: number[]): number {
        for (let index = 0; index < a.length; index++) {
            if (a[index] !== b[index]) {
                return a[index] - b[index]
            }
        }
        return 0
    }
}

export function revenueFor(route: Route | undefined): number {
    return route ? 1 + route.stations : 0
}

export interface StationEarning {
    station: PlacedStation
    ownerId: string
    route: Route | undefined
    amount: number
    bonuses: Payment[]
}

// Designer ruling: a bonus goes to each other player's Power Station on the route, the destination
// included. The unowned setup tiles never collect.
export function stationEarnings(
    board: Board,
    chosen: ReadonlyMap<number, OffsetCoordinates[]> = new Map()
): StationEarning[] {
    const grid = new Grid(board)
    return board.stations.flatMap((station) => {
        const ownerId = station.ownerId
        if (ownerId === undefined) {
            return []
        }
        const cells = chosen.get(station.tileId)
        const route = cells
            ? {
                  cells,
                  stations: cells.filter((cell) => grid.stationAt(cell)?.faceUp).length
              }
            : grid.bestRoute(station.cell)
        const bonuses = route
            ? bonusPayees(grid, route.cells, ownerId).map((playerId) => ({ playerId, amount: 1 }))
            : []
        return [{ station, ownerId, route, amount: revenueFor(route), bonuses }]
    })
}

function bonusPayees(grid: Grid, cells: OffsetCoordinates[], ownerId: string): string[] {
    return cells.slice(1).flatMap((cell) => {
        const passed = grid.stationAt(cell)
        return passed?.ownerId !== undefined &&
            passed.ownerId !== ownerId &&
            passed.faceUp &&
            passed.cubes > 0
            ? [passed.ownerId]
            : []
    })
}
